import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../users/user.entity';

@Entity('notification_preferences')
export class NotificationPreferenceEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ name: 'alerts_enabled', type: 'boolean', default: true })
  alertsEnabled: boolean;

  @Column({ name: 'star_index_alert_enabled', type: 'boolean', default: true })
  starIndexAlertEnabled: boolean;

  @Column({ name: 'astronomy_event_alert_enabled', type: 'boolean', default: true })
  astronomyEventAlertEnabled: boolean;

  @Column({ name: 'top3_alert_enabled', type: 'boolean', default: true })
  top3AlertEnabled: boolean;

  /** Star-Index 임계 알림 기준 명소 — 없으면 해당 알림 스케줄에서 제외 */
  @Column({ name: 'alert_spot_id', type: 'uuid', nullable: true })
  alertSpotId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
