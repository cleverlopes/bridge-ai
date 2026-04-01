import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type EventStatus = 'pending' | 'processed' | 'failed' | 'skipped';

@Entity('events')
export class AppEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  @Index()
  type!: string;

  @Column({ length: 100 })
  @Index()
  channel!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  correlationId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  conversationId!: string | null;

  @Column({ type: 'jsonb', default: '{}' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status!: EventStatus;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
