import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { WeatherSnapshot } from '../common/interfaces/weather-snapshot';

@Entity('spot_reports')
export class SpotReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'text' })
  message: string;

  /** 제보자가 선택한 관측 위치 라벨 (현재 위치/명소/직접 입력) */
  @Column({ name: 'place_label', type: 'varchar', length: 120, nullable: true })
  placeLabel: string | null;

  @Column({ name: 'star_index_val', type: 'smallint' })
  starIndexVal: number;

  @Column({ name: 'weather_snapshot', type: 'jsonb' })
  weatherSnapshot: WeatherSnapshot;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
