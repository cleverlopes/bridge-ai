import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Project } from './entities/project.entity';
import { Plan } from './entities/plan.entity';
import { Phase } from './entities/phase.entity';
import { ExecutionMetric } from './entities/execution-metric.entity';
import { AppEvent } from './entities/event.entity';
import { Secret } from './entities/secret.entity';
import { SecretAudit } from './entities/secret-audit.entity';
import { HealthModule } from './modules/health/health.module';
import { KsmModule } from './modules/ksm/ksm.module';
import { EventsModule } from './modules/events/events.module';
import { ProjectModule } from './modules/project/project.module';

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
        connection: {
          url: config.get<string>('REDIS_URL'),
        },
      }),
    }),

    HealthModule,
    KsmModule,
    EventsModule,
    ProjectModule,
  ],
})
export class AppModule {}
