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

/** 위치한 곳 Star-Index 임계 푸시 — 사용자·KST 일 단위 중복 방지 */
@Entity('location_star_index_push_sent')
@Unique(['userId', 'sentDayKst'])
@Index('idx_location_star_index_push_sent_day', ['sentDayKst'])
export class LocationStarIndexPushSentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'sent_day_kst', type: 'date' })
  sentDayKst: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
