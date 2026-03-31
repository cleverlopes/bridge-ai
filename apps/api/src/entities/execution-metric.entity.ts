import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Phase } from './phase.entity';
import { Project } from './project.entity';

@Entity('execution_metrics')
export class ExecutionMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  phaseId!: string;

  @Column('uuid')
  projectId!: string;

  @Column({ type: 'integer', default: 0 })
  durationMs!: number;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  costUsd!: number | null;

  @Column({ type: 'integer', default: 0 })
  tokensIn!: number;

  @Column({ type: 'integer', default: 0 })
  tokensOut!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  modelUsed!: string | null;

  @Column({ type: 'smallint', default: 0 })
  iterationCount!: number;

  @Column({ type: 'boolean', default: false })
  success!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Phase, (phase) => phase.metrics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phaseId' })
  phase!: Phase;

  @ManyToOne(() => Project, (project) => project.metrics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;
}
