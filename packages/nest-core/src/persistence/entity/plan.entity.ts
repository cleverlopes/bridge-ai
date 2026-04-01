import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { Phase } from './phase.entity';

export type PlanStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved_queued'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'archived'
  // Legacy aliases kept for any existing rows
  | 'pending'
  | 'running'
  | 'cancelled';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  projectId!: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'draft',
  })
  status!: PlanStatus;

  @Column({ type: 'text', nullable: true })
  prompt!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  conversationId!: string | null;

  @Column({ type: 'text', nullable: true })
  roadmapPath!: string | null;

  @Column({ type: 'text', nullable: true })
  workspacePath!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  providerId!: string | null;

  @Column({ type: 'text', nullable: true })
  failReason!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Project, (project) => project.plans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @OneToMany(() => Phase, (phase) => phase.plan)
  phases!: Phase[];
}
