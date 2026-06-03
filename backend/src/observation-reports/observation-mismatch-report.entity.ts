import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ObservationMismatchType =
  | 'unmeasurable_but_success'
  | 'high_score_but_fail'
  | 'felt_score_differs';

export type ObservationMismatchReportStatus = 'pending' | 'reviewed';

@Entity('observation_mismatch_reports')
export class ObservationMismatchReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'observation_id', type: 'uuid' })
  observationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'mismatch_type', type: 'varchar', length: 32 })
  mismatchType: ObservationMismatchType;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: ObservationMismatchReportStatus;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
