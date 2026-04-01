import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Plan } from './plan.entity';
import { ExecutionMetric } from './execution-metric.entity';

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

@Entity('phases')
export class Phase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  planId!: string;

  @Column({ type: 'smallint' })
  phaseNumber!: number;

  @Column({ length: 255 })
  phaseName!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: PhaseStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @ManyToOne(() => Plan, (plan) => plan.phases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planId' })
  plan!: Plan;

  @OneToMany(() => ExecutionMetric, (metric) => metric.phase)
  metrics!: ExecutionMetric[];
}
