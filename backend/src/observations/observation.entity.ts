import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WeatherSnapshot } from '../common/interfaces/weather-snapshot';

@Entity('observations')
export class ObservationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'spot_id', type: 'uuid', nullable: true })
  spotId: string | null;

  @Column({ name: 'star_index_val', type: 'smallint' })
  starIndexVal: number;

  @Column({ name: 'weather_snapshot', type: 'jsonb' })
  weatherSnapshot: WeatherSnapshot;

  @Column({ type: 'varchar', length: 16 })
  result: 'success' | 'partial' | 'fail';

  @Column({ type: 'varchar', length: 120, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'observed_at', type: 'timestamptz', default: () => 'now()' })
  observedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
