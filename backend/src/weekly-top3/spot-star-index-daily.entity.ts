import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** 명소별 일별 Star-Index (주간 평균 입력). */
@Entity('spot_star_index_daily')
export class SpotStarIndexDailyEntity {
  @PrimaryColumn({ name: 'spot_id', type: 'uuid' })
  spotId: string;

  @PrimaryColumn({ type: 'date' })
  day: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  score: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
