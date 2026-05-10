import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../users/user.entity';

/** 천체 이벤트 알림 — 사용자·이벤트별 1회 발송 기록 */
@Entity('astro_event_push_sent')
@Unique(['userId', 'eventId'])
@Index('idx_astro_event_push_sent_event', ['eventId'])
export class AstroEventPushSentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  /** 정적 카탈로그 또는 추후 DB 이벤트의 식별자 */
  @Column({ name: 'event_id', type: 'text' })
  eventId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
