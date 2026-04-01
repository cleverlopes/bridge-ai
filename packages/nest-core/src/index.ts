export { AppModule } from './app.module';
export { AppDataSource } from './persistence/data-source';

export { AppEvent, EventStatus } from './persistence/entity/event.entity';
export { ExecutionMetric } from './persistence/entity/execution-metric.entity';
export { Phase, PhaseStatus } from './persistence/entity/phase.entity';
export { Plan, PlanStatus } from './persistence/entity/plan.entity';
export {
  Project,
  ProjectSettings,
  ProjectStatus,
} from './persistence/entity/project.entity';
export { SecretAction, SecretAudit } from './persistence/entity/secret-audit.entity';
export { Secret, SecretScope } from './persistence/entity/secret.entity';

export { EventsModule } from './module/events/events.module';
export {
  EventsService,
  PublishEventOptions,
} from './module/events/events.service';
export { HealthModule } from './module/health/health.module';
export { KsmModule } from './module/ksm/ksm.module';
export { KsmService } from './module/ksm/ksm.service';
export { ProjectModule } from './module/project/project.module';
export { ProjectService } from './module/project/project.service';
export { BrainModule } from './module/brain/brain.module';
export { BrainService } from './module/brain/brain.service';
export { PlanModule } from './module/plan/plan.module';
export { PlanService } from './module/plan/plan.service';
export { TelegramModule } from './module/telegram/telegram.module';
export { PipelineModule } from './module/pipeline/pipeline.module';
export { PipelineService } from './module/pipeline/pipeline.service';
export { WorkspaceService } from './module/pipeline/workspace.service';
export { DockerModule } from './module/docker/docker.module';
export { DockerService } from './module/docker/docker.service';
export { MetricsModule } from './module/metrics/metrics.module';
export {
  ExecutionMetricsService,
  PhaseMetricsInput,
  AggregatedMetrics,
} from './module/metrics/metrics.service';
export { ObsidianModule } from './module/obsidian/obsidian.module';
export { ObsidianSyncService } from './module/obsidian/obsidian-sync.service';
