import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('weekly_top3')
export class WeeklyTop3Entity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ type: 'smallint' })
  rank: number;

  @Column({ name: 'spot_id', type: 'uuid' })
  spotId: string;

  @Column({
    name: 'avg_star_index',
    type: 'numeric',
    precision: 5,
    scale: 2,
  })
  avgStarIndex: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
