import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Plan } from './plan.entity';
import { ExecutionMetric } from './execution-metric.entity';

export type ProjectStatus = 'active' | 'archived' | 'paused';

export interface ProjectSettings {
  providerId?: string;
  model?: string;
  autoApprove?: boolean;
  maxBudgetUsd?: number;
  maxTurnsPerStep?: number;
  [key: string]: unknown;
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 100 })
  slug!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  stack!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status!: ProjectStatus;

  @Column({ type: 'jsonb', default: '{}' })
  settings!: ProjectSettings;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Plan, (plan) => plan.project)
  plans!: Plan[];

  @OneToMany(() => ExecutionMetric, (metric) => metric.project)
  metrics!: ExecutionMetric[];
}
