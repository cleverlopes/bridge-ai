import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BrainModule } from '../brain/brain.module';
import { PlanModule } from '../plan/plan.module';
import { TelegramModule } from '../telegram/telegram.module';
import { EventsModule } from '../events/events.module';
import { DockerModule } from '../docker/docker.module';
import { ObsidianModule } from '../obsidian/obsidian.module';
import { QUEUE_EXECUTION_JOBS, QUEUE_WORKFLOW_EVENTS } from '../events/events.service';
import { PipelineService } from './pipeline.service';
import { WorkspaceService } from './workspace.service';
import { HumanGateBridge } from './human-gate.bridge';
import { ExecutionWorker } from './execution.worker';
import { WorkflowEventsWorker } from './workflow-events.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_EXECUTION_JOBS }, { name: QUEUE_WORKFLOW_EVENTS }),
    BrainModule,
    PlanModule,
    TelegramModule,
    EventsModule,
    DockerModule,
    ObsidianModule,
  ],
  providers: [PipelineService, WorkspaceService, HumanGateBridge, ExecutionWorker, WorkflowEventsWorker],
  exports: [PipelineService, WorkspaceService],
})
export class PipelineModule {}
