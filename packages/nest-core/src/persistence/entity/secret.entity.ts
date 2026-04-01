import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { SecretAudit } from './secret-audit.entity';

export type SecretScope = 'global' | 'project';

@Entity('secrets')
@Index(['name', 'scope', 'scopeId'], { unique: true })
export class Secret {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'global',
  })
  scope!: SecretScope;

  @Column({ type: 'uuid', nullable: true })
  scopeId!: string | null;

  @Column({ type: 'text' })
  encryptedValue!: string;

  @Column({ length: 20, default: 'aes-256-gcm' })
  algorithm!: string;

  @Column({ type: 'smallint', default: 1 })
  keyVersion!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => SecretAudit, (audit) => audit.secret)
  auditLog!: SecretAudit[];
}
