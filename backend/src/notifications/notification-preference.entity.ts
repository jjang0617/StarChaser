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

  /** 위치한 곳(GPS) Star-Index 푸시 — ME·MAIN 공통 */
  @Column({ name: 'location_star_index_alert_enabled', type: 'boolean', default: true })
  locationStarIndexAlertEnabled: boolean;

  /** Star-Index 푸시 임계값 — 80·85·90·95 */
  @Column({ name: 'star_index_alert_threshold', type: 'int', default: 90 })
  starIndexAlertThreshold: number;

  /** Star-Index 임계 알림 기준 명소 — 없으면 해당 알림 스케줄에서 제외 */
  @Column({ name: 'alert_spot_id', type: 'uuid', nullable: true })
  alertSpotId: string | null;

  /** 위치한 곳 알림용 — 앱에서 보고한 마지막 GPS */
  @Column({ name: 'last_observer_lat', type: 'double precision', nullable: true })
  lastObserverLat: number | null;

  @Column({ name: 'last_observer_lng', type: 'double precision', nullable: true })
  lastObserverLng: number | null;

  @Column({ name: 'last_observer_place_label', type: 'varchar', length: 120, nullable: true })
  lastObserverPlaceLabel: string | null;

  @Column({ name: 'last_observer_at', type: 'timestamptz', nullable: true })
  lastObserverAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
