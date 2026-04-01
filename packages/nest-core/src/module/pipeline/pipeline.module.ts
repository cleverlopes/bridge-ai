import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BrainModule } from '../brain/brain.module';
import { PlanModule } from '../plan/plan.module';
import { TelegramModule } from '../telegram/telegram.module';
import { EventsModule } from '../events/events.module';
import { QUEUE_EXECUTION_JOBS } from '../events/events.service';
import { PipelineService } from './pipeline.service';
import { WorkspaceService } from './workspace.service';
import { HumanGateBridge } from './human-gate.bridge';
import { ExecutionWorker } from './execution.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_EXECUTION_JOBS }),
    BrainModule,
    PlanModule,
    TelegramModule,
    EventsModule,
  ],
  providers: [PipelineService, WorkspaceService, HumanGateBridge, ExecutionWorker],
  exports: [PipelineService, WorkspaceService],
})
export class PipelineModule {}
