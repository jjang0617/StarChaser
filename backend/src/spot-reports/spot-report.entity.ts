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

  @Column({ name: 'star_index_val', type: 'smallint' })
  starIndexVal: number;

  @Column({ name: 'weather_snapshot', type: 'jsonb' })
  weatherSnapshot: WeatherSnapshot;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
