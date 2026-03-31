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

export type PlanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  projectId!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: PlanStatus;

  @Column({ type: 'text', nullable: true })
  roadmapPath!: string | null;

  @Column({ type: 'text', nullable: true })
  workspacePath!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  providerId!: string | null;

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
