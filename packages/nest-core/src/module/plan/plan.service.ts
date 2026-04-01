import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Plan, PlanStatus } from '../../persistence/entity/plan.entity';
import {
  EventsService,
  QUEUE_EXECUTION_JOBS,
  QUEUE_WORKFLOW_EVENTS,
} from '../events/events.service';

const TERMINAL_STATES: PlanStatus[] = ['completed', 'failed', 'stopped'];
const ARCHIVE_AFTER_DAYS = 7;

@Injectable()
export class PlanService implements OnModuleInit {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly events: EventsService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    const recovered = await this.recoverInterruptedPlans();
    if (recovered.length > 0) {
      this.logger.warn(`Recovered ${recovered.length} interrupted plan(s) on startup`);
    }
  }

  async createPlan(projectId: string, prompt: string, conversationId: string): Promise<Plan> {
    const plan = this.planRepo.create({
      projectId,
      prompt,
      conversationId,
      status: 'draft',
    });
    const saved = await this.planRepo.save(plan);
    await this.events.publish({
      type: 'plan.created',
      channel: QUEUE_WORKFLOW_EVENTS,
      payload: { planId: saved.id, projectId, conversationId },
      correlationId: saved.id,
      conversationId,
    });
    this.logger.log(`Plan ${saved.id} created (draft)`);
    return saved;
  }

  async submitForApproval(planId: string): Promise<Plan> {
    const plan = await this.requirePlan(planId);
    this.assertStatus(plan, ['draft'], 'submitForApproval');
    await this.planRepo.update(planId, { status: 'awaiting_approval' });
    await this.events.publish({
      type: 'plan.awaiting_approval',
      channel: QUEUE_WORKFLOW_EVENTS,
      payload: { planId, projectId: plan.projectId },
      correlationId: planId,
      conversationId: plan.conversationId ?? undefined,
    });
    this.logger.log(`Plan ${planId} submitted for approval`);
    return { ...plan, status: 'awaiting_approval' };
  }

  async approvePlan(planId: string): Promise<Plan> {
    const plan = await this.requirePlan(planId);
    this.assertStatus(plan, ['awaiting_approval'], 'approvePlan');
    await this.planRepo.update(planId, { status: 'approved_queued' });
    await this.events.publish({
      type: 'plan.execution_queued',
      channel: QUEUE_EXECUTION_JOBS,
      payload: { planId, projectId: plan.projectId },
      correlationId: planId,
      conversationId: plan.conversationId ?? undefined,
    });
    this.logger.log(`Plan ${planId} approved and queued for execution`);
    return { ...plan, status: 'approved_queued' };
  }

  async startExecution(planId: string): Promise<Plan> {
    const plan = await this.claimForExecution(planId);
    if (!plan) {
      throw new BadRequestException(`Plan ${planId} could not be claimed for execution`);
    }
    await this.events.publish({
      type: 'plan.execution_started',
      channel: QUEUE_WORKFLOW_EVENTS,
      payload: { planId, projectId: plan.projectId },
      correlationId: planId,
      conversationId: plan.conversationId ?? undefined,
    });
    this.logger.log(`Plan ${planId} execution started`);
    return plan;
  }

  async completePlan(planId: string): Promise<Plan> {
    const plan = await this.requirePlan(planId);
    await this.planRepo.update(planId, { status: 'completed' });
    await this.events.publish({
      type: 'plan.completed',
      channel: QUEUE_WORKFLOW_EVENTS,
      payload: { planId, projectId: plan.projectId },
      correlationId: planId,
      conversationId: plan.conversationId ?? undefined,
    });
    this.logger.log(`Plan ${planId} completed`);
    return { ...plan, status: 'completed' };
  }

  async failPlan(planId: string, reason: string): Promise<Plan> {
    const plan = await this.requirePlan(planId);
    await this.planRepo.update(planId, { status: 'failed', failReason: reason });
    await this.events.publish({
      type: 'plan.failed',
      channel: QUEUE_WORKFLOW_EVENTS,
      payload: { planId, projectId: plan.projectId, reason },
      correlationId: planId,
      conversationId: plan.conversationId ?? undefined,
    });
    this.logger.warn(`Plan ${planId} failed: ${reason}`);
    return { ...plan, status: 'failed', failReason: reason };
  }

  async stopPlan(planId: string): Promise<Plan> {
    const plan = await this.requirePlan(planId);
    this.assertStatus(plan, ['approved_queued', 'executing'], 'stopPlan');
    await this.planRepo.update(planId, { status: 'stopped' });
    await this.events.publish({
      type: 'plan.stopped',
      channel: QUEUE_WORKFLOW_EVENTS,
      payload: { planId, projectId: plan.projectId },
      correlationId: planId,
      conversationId: plan.conversationId ?? undefined,
    });
    this.logger.log(`Plan ${planId} stopped`);
    return { ...plan, status: 'stopped' };
  }

  async retryPlan(planId: string): Promise<Plan> {
    const plan = await this.requirePlan(planId);
    this.assertStatus(plan, ['stopped', 'failed'], 'retryPlan');
    await this.planRepo.update(planId, { status: 'approved_queued', failReason: null });
    await this.events.publish({
      type: 'plan.execution_queued',
      channel: QUEUE_EXECUTION_JOBS,
      payload: { planId, projectId: plan.projectId, retry: true },
      correlationId: planId,
      conversationId: plan.conversationId ?? undefined,
    });
    this.logger.log(`Plan ${planId} re-queued for retry`);
    return { ...plan, status: 'approved_queued' };
  }

  async getPlan(planId: string): Promise<Plan> {
    return this.requirePlan(planId);
  }

  async getActivePlanForConversation(conversationId: string): Promise<Plan | null> {
    return this.planRepo.findOne({
      where: { conversationId, status: In(['draft', 'awaiting_approval', 'approved_queued', 'executing']) },
      order: { createdAt: 'DESC' },
    });
  }

  async recoverInterruptedPlans(): Promise<Plan[]> {
    const interrupted = await this.planRepo.find({
      where: { status: 'executing' },
    });

    for (const plan of interrupted) {
      await this.planRepo.update(plan.id, { status: 'approved_queued' });
      await this.events.publish({
        type: 'plan.execution_queued',
        channel: QUEUE_EXECUTION_JOBS,
        payload: { planId: plan.id, projectId: plan.projectId, recovered: true },
        correlationId: plan.id,
        conversationId: plan.conversationId ?? undefined,
      });
      await this.events.publish({
        type: 'plan.recovered',
        channel: QUEUE_WORKFLOW_EVENTS,
        payload: { planId: plan.id, projectId: plan.projectId, recovered: true },
        correlationId: plan.id,
        conversationId: plan.conversationId ?? undefined,
      });
      this.logger.warn(`Recovered interrupted plan ${plan.id} → re-queued`);
    }

    return interrupted;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async archiveOldPlans(): Promise<void> {
    const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.planRepo.update(
      {
        status: In(TERMINAL_STATES),
        updatedAt: LessThan(cutoff),
      },
      { status: 'archived' },
    );
    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.log(`Archived ${count} old plan(s)`);
    }
  }

  private async claimForExecution(planId: string): Promise<Plan | null> {
    return this.dataSource.transaction(async (manager) => {
      const [plan] = await manager.query<Plan[]>(
        `SELECT * FROM plans WHERE id = $1 AND status = 'approved_queued' FOR UPDATE SKIP LOCKED`,
        [planId],
      );
      if (!plan) return null;
      await manager.update(Plan, planId, { status: 'executing' });
      return { ...plan, status: 'executing' as PlanStatus };
    });
  }

  private async requirePlan(planId: string): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException(`Plan ${planId} not found`);
    }
    return plan;
  }

  private assertStatus(plan: Plan, allowed: PlanStatus[], operation: string): void {
    if (!allowed.includes(plan.status)) {
      throw new BadRequestException(
        `Plan ${plan.id} cannot ${operation}: status is '${plan.status}', expected one of [${allowed.join(', ')}]`,
      );
    }
  }
}
