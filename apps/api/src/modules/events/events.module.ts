import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AppEvent } from '../../entities/event.entity';
import { EventsService } from './events.service';
import {
  QUEUE_PROJECT_EVENTS,
  QUEUE_EXECUTION_JOBS,
  QUEUE_WORKFLOW_EVENTS,
} from './events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppEvent]),
    BullModule.registerQueue(
      { name: QUEUE_PROJECT_EVENTS },
      { name: QUEUE_EXECUTION_JOBS },
      { name: QUEUE_WORKFLOW_EVENTS },
    ),
  ],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
