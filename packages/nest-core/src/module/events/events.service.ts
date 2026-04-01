import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { AppEvent, EventStatus } from '../../persistence/entity/event.entity';

export const QUEUE_PROJECT_EVENTS = 'project.events';
export const QUEUE_EXECUTION_JOBS = 'execution.jobs';
export const QUEUE_WORKFLOW_EVENTS = 'workflow.events';

export interface PublishEventOptions {
  type: string;
  channel: typeof QUEUE_PROJECT_EVENTS | typeof QUEUE_EXECUTION_JOBS | typeof QUEUE_WORKFLOW_EVENTS;
  payload: Record<string, unknown>;
  correlationId?: string;
  conversationId?: string;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(AppEvent)
    private readonly eventRepo: Repository<AppEvent>,
    @InjectQueue(QUEUE_PROJECT_EVENTS)
    private readonly projectEventsQueue: Queue,
    @InjectQueue(QUEUE_EXECUTION_JOBS)
    private readonly executionJobsQueue: Queue,
    @InjectQueue(QUEUE_WORKFLOW_EVENTS)
    private readonly workflowEventsQueue: Queue,
  ) {}

  async publish(options: PublishEventOptions): Promise<AppEvent> {
    const event = this.eventRepo.create({
      type: options.type,
      channel: options.channel,
      payload: options.payload,
      correlationId: options.correlationId ?? null,
      conversationId: options.conversationId ?? null,
      status: 'pending' as EventStatus,
    });
    const saved = await this.eventRepo.save(event);

    const queue = this.resolveQueue(options.channel);
    await queue.add(options.type, { eventId: saved.id, ...options.payload });

    this.logger.debug(`Published event ${options.type} to ${options.channel}`);
    return saved;
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.eventRepo.update(eventId, {
      status: 'processed',
      processedAt: new Date(),
    });
  }

  async markFailed(eventId: string): Promise<void> {
    await this.eventRepo.update(eventId, { status: 'failed' });
  }

  private resolveQueue(
    channel: typeof QUEUE_PROJECT_EVENTS | typeof QUEUE_EXECUTION_JOBS | typeof QUEUE_WORKFLOW_EVENTS,
  ): Queue {
    switch (channel) {
      case QUEUE_PROJECT_EVENTS:
        return this.projectEventsQueue;
      case QUEUE_EXECUTION_JOBS:
        return this.executionJobsQueue;
      case QUEUE_WORKFLOW_EVENTS:
        return this.workflowEventsQueue;
    }
  }
}
