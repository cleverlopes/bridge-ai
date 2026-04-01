import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEvent } from './persistence/entity/event.entity';
import { ExecutionMetric } from './persistence/entity/execution-metric.entity';
import { Phase } from './persistence/entity/phase.entity';
import { Plan } from './persistence/entity/plan.entity';
import { Project } from './persistence/entity/project.entity';
import { Secret } from './persistence/entity/secret.entity';
import { SecretAudit } from './persistence/entity/secret-audit.entity';
import { EventsModule } from './module/events/events.module';
import { HealthModule } from './module/health/health.module';
import { KsmModule } from './module/ksm/ksm.module';
import { ProjectModule } from './module/project/project.module';
import { BrainModule } from './module/brain/brain.module';
import { PlanModule } from './module/plan/plan.module';
import { TelegramModule } from './module/telegram/telegram.module';
import { PipelineModule } from './module/pipeline/pipeline.module';
import { DockerModule } from './module/docker/docker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: [Project, Plan, Phase, ExecutionMetric, AppEvent, Secret, SecretAudit],
        migrations: ['dist/migrations/*.js'],
        synchronize: false,
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.get<string>('REDIS_URL'),
      }),
    }),

    HealthModule,
    KsmModule,
    EventsModule,
    ProjectModule,
    BrainModule,
    PlanModule,
    TelegramModule,
    PipelineModule,
    DockerModule,
  ],
})
export class AppModule {}
