import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bullmq';
import { EventsService, QUEUE_EXECUTION_JOBS } from '../events/events.service';
import { PipelineService } from './pipeline.service';
import { PlanService } from '../plan/plan.service';

interface ExecutionJobPayload {
  eventId?: string;
  planId: string;
  projectId?: string;
  recovered?: boolean;
}

@Processor(QUEUE_EXECUTION_JOBS)
export class ExecutionWorker {
  private readonly logger = new Logger(ExecutionWorker.name);

  constructor(
    private readonly pipeline: PipelineService,
    private readonly plans: PlanService,
    private readonly events: EventsService,
  ) {}

  @Process()
  async handleExecutionJob(job: Job<ExecutionJobPayload>): Promise<void> {
    const { planId, eventId } = job.data;

    if (!planId) {
      this.logger.error(`ExecutionWorker received job without planId: ${JSON.stringify(job.data)}`);
      return;
    }

    this.logger.log(`ExecutionWorker processing planId=${planId}`);

    try {
      await this.pipeline.executeProject(planId);
      this.logger.log(`ExecutionWorker completed planId=${planId}`);
      if (eventId) {
        await this.events.markProcessed(eventId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`ExecutionWorker failed planId=${planId}: ${message}`);

      if (eventId) {
        try {
          await this.events.markFailed(eventId);
        } catch (markErr) {
          this.logger.error(`ExecutionWorker could not mark event ${eventId} as failed: ${markErr instanceof Error ? markErr.message : markErr}`);
        }
      }

      try {
        await this.plans.failPlan(planId, message);
      } catch (failErr) {
        this.logger.error(
          `ExecutionWorker could not mark plan ${planId} as failed: ${failErr instanceof Error ? failErr.message : failErr}`,
        );
      }

      throw err;
    }
  }
}
