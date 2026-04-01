import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Project } from './project.entity';
import { IndexPayload } from '../../module/workspace/types';

@Entity('workspace_snapshots')
export class WorkspaceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ unique: true, type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column({ type: 'text' })
  workspacePath!: string;

  @Column({ type: 'text', nullable: true })
  remoteUrl!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  remoteName!: string | null;

  @Column({ type: 'varchar', length: 255, default: 'main' })
  baseBranch!: string;

  @Column({ type: 'varchar', length: 255 })
  currentBranch!: string;

  @Column({ type: 'varchar', length: 40 })
  headSha!: string;

  @Column({ type: 'boolean', default: false })
  isDirty!: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  indexPayload!: IndexPayload;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  indexedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
