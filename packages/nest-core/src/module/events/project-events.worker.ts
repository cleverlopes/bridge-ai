import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bullmq';
import { EventsService, QUEUE_PROJECT_EVENTS } from './events.service';

interface ProjectEventJobPayload {
  eventId: string;
  [key: string]: unknown;
}

/**
 * Consumer for persisted project events.
 *
 * The EventsService persists events with status=pending, enqueues a BullMQ job
 * containing { eventId, ...payload }, and this worker marks the persisted record
 * as processed (or failed).
 */
@Processor(QUEUE_PROJECT_EVENTS)
export class ProjectEventsWorker {
  private readonly logger = new Logger(ProjectEventsWorker.name);

  constructor(private readonly events: EventsService) {}

  @Process()
  async handle(job: Job<ProjectEventJobPayload>): Promise<void> {
    const eventId = job.data?.eventId;
    if (!eventId) {
      this.logger.warn(`ProjectEventsWorker received job without eventId: ${JSON.stringify(job.data)}`);
      return;
    }

    try {
      await this.events.markProcessed(eventId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to mark event ${eventId} as processed: ${message}`);
      try {
        await this.events.markFailed(eventId);
      } catch (markErr) {
        this.logger.error(
          `Failed to mark event ${eventId} as failed: ${markErr instanceof Error ? markErr.message : markErr}`,
        );
      }
      throw err;
    }
  }
}

