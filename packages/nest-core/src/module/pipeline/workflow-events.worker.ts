import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bullmq';
import { EventsService, QUEUE_WORKFLOW_EVENTS } from '../events/events.service';
import { HumanGateBridge } from './human-gate.bridge';
import { TelegramNotifierService } from '../telegram/telegram-notifier.service';

interface WorkflowEventJobPayload {
  eventId?: string;
  type?: string;
  key?: string;
  response?: string;
  conversationId?: string;
  planId?: string;
  projectId?: string;
  [key: string]: unknown;
}

@Processor(QUEUE_WORKFLOW_EVENTS)
export class WorkflowEventsWorker {
  private readonly logger = new Logger(WorkflowEventsWorker.name);

  constructor(
    private readonly humanGate: HumanGateBridge,
    private readonly notifier: TelegramNotifierService,
    private readonly events: EventsService,
  ) {}

  @Process()
  async handle(job: Job<WorkflowEventJobPayload>): Promise<void> {
    const type = String(job.name ?? job.data?.type ?? '');
    const eventId = job.data?.eventId;

    try {
      if (type === 'telegram.gate_response') {
        this.handleGateResponse(job);
      } else if (type === 'plan.recovered') {
        await this.handlePlanRecovered(job);
      }

      if (eventId) {
        await this.events.markProcessed(eventId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to process workflow event ${type} (${eventId ?? 'no-id'}): ${message}`);
      if (eventId) {
        try {
          await this.events.markFailed(eventId);
        } catch (markErr) {
          this.logger.error(`Failed to mark event ${eventId} as failed: ${markErr instanceof Error ? markErr.message : markErr}`);
        }
      }
      throw err;
    }
  }

  private handleGateResponse(job: Job<WorkflowEventJobPayload>): void {
    const key = String(job.data?.key ?? '');
    const response = String(job.data?.response ?? '');
    if (!key || !response) {
      this.logger.warn(`telegram.gate_response missing key/response: ${JSON.stringify(job.data)}`);
      return;
    }

    const ok = this.humanGate.resolveGate(key, response);
    if (!ok) {
      this.logger.warn(`No pending gate found for key=${key}`);
    }
  }

  private async handlePlanRecovered(job: Job<WorkflowEventJobPayload>): Promise<void> {
    const conversationId = job.data?.conversationId;
    const planId = job.data?.planId ?? 'unknown';
    if (!conversationId) {
      this.logger.debug(`plan.recovered event has no conversationId, skipping notification`);
      return;
    }
    await this.notifier.send(
      conversationId,
      `🔄 *Plan recovered*\nPlan \`${planId}\` was interrupted and has been automatically re-queued for execution.`,
    );
  }
}

