import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Secret } from './secret.entity';

export type SecretAction = 'create' | 'read' | 'rotate' | 'delete';

@Entity('secret_audit')
export class SecretAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  secretId!: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  action!: SecretAction;

  @Column({ length: 200 })
  callerModule!: string;

  @Column({ type: 'uuid', nullable: true })
  callerProjectId!: string | null;

  @CreateDateColumn()
  accessedAt!: Date;

  @ManyToOne(() => Secret, (secret) => secret.auditLog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'secretId' })
  secret!: Secret;
}
