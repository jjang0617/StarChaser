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
import { SpotEntity } from '../spots/spot.entity';

/** Star-Index 임계 푸시 — 사용자·명소·KST 일 단위 중복 방지 */
@Entity('star_index_push_sent')
@Unique(['userId', 'spotId', 'sentDayKst'])
@Index('idx_star_index_push_sent_day', ['sentDayKst'])
export class StarIndexPushSentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'spot_id', type: 'uuid' })
  spotId: string;

  @ManyToOne(() => SpotEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spot_id' })
  spot: SpotEntity;

  /** KST 기준 YYYY-MM-DD */
  @Column({ name: 'sent_day_kst', type: 'date' })
  sentDayKst: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
