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

export { BrainModule } from './module/brain/brain.module';
export { BrainService } from './module/brain/brain.service';
export type { BrainGenerateOptions } from './module/brain/brain.service';
export { EventsModule } from './module/events/events.module';
export {
  EventsService,
  PublishEventOptions,
} from './module/events/events.service';
export { HealthModule } from './module/health/health.module';
export { KsmModule } from './module/ksm/ksm.module';
export { KsmService } from './module/ksm/ksm.service';
export { PlanModule } from './module/plan/plan.module';
export { PlanService } from './module/plan/plan.service';
export { ProjectModule } from './module/project/project.module';
export { ProjectService } from './module/project/project.service';
export { TelegramModule } from './module/telegram/telegram.module';
export { TelegramNotifierService } from './module/telegram/telegram-notifier.service';
export { ConversationStateService } from './module/telegram/conversation-state.service';
