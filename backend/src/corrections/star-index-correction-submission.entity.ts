import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 명소별 관측자 체감 가시도(0~100) 제보 — Star-Index correction_score 집계 소스 */
@Entity('star_index_correction_submissions')
export class StarIndexCorrectionSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'spot_id', type: 'uuid' })
  spotId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** 체감 가시도 0(매우 나쁨)~100(매우 좋음) — 집계 후 correction_score로 반영 */
  @Column({ name: 'perceived_quality', type: 'smallint' })
  perceivedQuality: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
