import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Project } from './entities/project.entity';
import { Plan } from './entities/plan.entity';
import { Phase } from './entities/phase.entity';
import { ExecutionMetric } from './entities/execution-metric.entity';
import { AppEvent } from './entities/event.entity';
import { Secret } from './entities/secret.entity';
import { SecretAudit } from './entities/secret-audit.entity';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://bridge:bridge@localhost:5432/bridge';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: DATABASE_URL,
  entities: [Project, Plan, Phase, ExecutionMetric, AppEvent, Secret, SecretAudit],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: process.env['NODE_ENV'] !== 'production',
});
