import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { resolve } from 'node:path';
import { GSD, ObsidianTransport, PostgresTransport, GSDEventType } from '@bridge-ai/gsd-sdk';
import type { GSDEvent, GSDPhaseStartEvent, GSDPhaseCompleteEvent, GSDMilestoneStartEvent, GSDCostUpdateEvent } from '@bridge-ai/gsd-sdk';
import { BrainService } from '../brain/brain.service';
import { PlanService } from '../plan/plan.service';
import { EventsService, QUEUE_WORKFLOW_EVENTS } from '../events/events.service';
import { TelegramNotifierService } from '../telegram/telegram-notifier.service';
import { WorkspaceService } from './workspace.service';
import { HumanGateBridge } from './human-gate.bridge';
import { DockerService } from '../docker/docker.service';
import { ObsidianSyncService } from '../obsidian/obsidian-sync.service';
import { EphemeralWorkspaceService } from '../workspace/ephemeral-workspace.service';
import { WorkspaceSnapshot } from '../../persistence/entity/workspace-snapshot.entity';

const OBSIDIAN_VAULT_PATH = resolve(process.cwd(), 'volumes', 'obsidian');

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly brain: BrainService,
    private readonly plans: PlanService,
    private readonly events: EventsService,
    private readonly notifier: TelegramNotifierService,
    private readonly workspace: WorkspaceService,
    private readonly humanGate: HumanGateBridge,
    private readonly obsidian: ObsidianSyncService,
    @Optional() private readonly docker: DockerService | null,
    @Optional() private readonly ephemeralWorkspace: EphemeralWorkspaceService | null,
    @InjectRepository(WorkspaceSnapshot)
    private readonly snapshotRepo: Repository<WorkspaceSnapshot>,
  ) {}

  async executeProject(planId: string): Promise<void> {
    const plan = await this.plans.startExecution(planId);
    const projectId = plan.projectId;
    const conversationId = plan.conversationId ?? null;
    const prompt = plan.prompt ?? '';

    const snapshot = await this.snapshotRepo.findOne({ where: { projectId } });
    let runId: string | null = null;
    let workspacePath: string;

    if (snapshot && this.ephemeralWorkspace) {
      runId = planId;
      workspacePath = await this.ephemeralWorkspace.cloneForRun(snapshot.workspacePath, runId);
      this.logger.log(`Using ephemeral workspace for project ${projectId} at ${workspacePath}`);
    } else {
      workspacePath = this.workspace.provisionWorkspace(projectId, planId);
    }

    let containerId: string | null = null;
    if (this.docker) {
      try {
        containerId = await this.docker.createContainer(projectId, workspacePath);
        this.logger.log(`Container ${containerId.slice(0, 12)} ready for project ${projectId}`);
      } catch (err) {
        this.logger.warn(`Failed to create Docker container for ${projectId}: ${err instanceof Error ? err.message : err}. Continuing without container.`);
      }
    }

    const gsd = new GSD({
      projectDir: workspacePath,
      adapter: this.brain,
      autoMode: false,
    });

    await this.obsidian.ensureVaultStructure();
    await this.obsidian.ensureTemplates();

    const projectSlug = await this.obsidian.getProjectSlug(projectId);
    gsd.addTransport(
      new ObsidianTransport({
        vaultPath: OBSIDIAN_VAULT_PATH,
        ...(projectSlug ? { projectSlug } : {}),
      }),
    );

    gsd.addTransport(
      new PostgresTransport({
        onEvent: (event: GSDEvent) => {
          this.events
            .publish({
              type: `gsd.${event.type}`,
              channel: QUEUE_WORKFLOW_EVENTS,
              payload: event as unknown as Record<string, unknown>,
              correlationId: planId,
              conversationId: conversationId ?? undefined,
            })
            .catch((err: unknown) => {
              this.logger.warn(`Failed to persist GSD event ${event.type}: ${err instanceof Error ? err.message : err}`);
            });
        },
      }),
    );

    gsd.onEvent((event: GSDEvent) => {
      this.forwardEventToTelegram(event, conversationId, planId).catch((err: unknown) => {
        this.logger.warn(`Failed to forward event to Telegram: ${err instanceof Error ? err.message : err}`);
      });
    });

    gsd.onEvent(async (event: GSDEvent) => {
      if (event.type === GSDEventType.PhaseComplete) {
        await this.obsidian.onPhaseComplete(event as GSDPhaseCompleteEvent, planId, projectId);
      }
      if (event.type === GSDEventType.MilestoneComplete) {
        await this.obsidian.onMilestoneComplete(projectId);
      }
    });

    const humanGateCallbacks = conversationId
      ? this.humanGate.buildCallbacks(conversationId, planId)
      : undefined;

    try {
      const result = await gsd.run(prompt, { callbacks: humanGateCallbacks });

      if (result.success) {
        await this.plans.completePlan(planId);
        if (conversationId) {
          await this.notifier.send(
            conversationId,
            `✅ *Plan complete!*\n\nTotal cost: $${result.totalCostUsd.toFixed(4)}\nPhases completed: ${result.phases.length}`,
          );
        }
      } else {
        const lastError = result.phases.find(p => !p.success);
        const reason = lastError ? `Phase ${lastError.phaseNumber} failed` : 'Execution failed';
        await this.plans.failPlan(planId, reason);
        if (conversationId) {
          await this.notifier.send(conversationId, `❌ *Plan failed:* ${reason}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Pipeline execution error for plan ${planId}: ${message}`);
      await this.plans.failPlan(planId, message);
      if (conversationId) {
        await this.notifier.send(conversationId, `❌ *Pipeline error:* ${message}`);
      }
    } finally {
      gsd.eventStream.closeAll();
      await this.cleanupContainer(projectId, containerId);
      if (runId && this.ephemeralWorkspace) {
        await this.ephemeralWorkspace.cleanupRun(runId).catch((e: unknown) => {
          this.logger.warn(`Failed to cleanup ephemeral workspace for run ${runId}: ${e instanceof Error ? e.message : e}`);
        });
      }
    }
  }

  private async cleanupContainer(projectId: string, containerId: string | null): Promise<void> {
    if (!this.docker || !containerId) return;

    try {
      await this.docker.stopContainer(projectId);
    } catch (err) {
      this.logger.warn(`Failed to stop container for ${projectId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async forwardEventToTelegram(
    event: GSDEvent,
    conversationId: string | null,
    planId: string,
  ): Promise<void> {
    if (!conversationId) return;

    switch (event.type) {
      case GSDEventType.MilestoneStart: {
        const e = event as GSDMilestoneStartEvent;
        await this.notifier.send(
          conversationId,
          `⚙ Starting execution: ${e.phaseCount} phases`,
        );
        break;
      }
      case GSDEventType.PhaseStart: {
        const e = event as GSDPhaseStartEvent;
        await this.notifier.send(
          conversationId,
          `▶ Starting Phase ${e.phaseNumber}: ${e.phaseName}...`,
        );
        break;
      }
      case GSDEventType.PhaseComplete: {
        const e = event as GSDPhaseCompleteEvent;
        const mins = Math.floor(e.totalDurationMs / 60000);
        const secs = Math.floor((e.totalDurationMs % 60000) / 1000);
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        const costStr = `$${e.totalCostUsd.toFixed(4)}`;
        await this.notifier.send(
          conversationId,
          `✓ Phase ${e.phaseNumber} complete — ${timeStr}, ${costStr}`,
        );
        break;
      }
      case GSDEventType.CostUpdate: {
        const e = event as GSDCostUpdateEvent;
        await this.notifier.send(
          conversationId,
          `💰 Cost so far: $${e.cumulativeCostUsd.toFixed(4)}`,
        );
        break;
      }
      default:
        break;
    }

    void planId;
  }
}
