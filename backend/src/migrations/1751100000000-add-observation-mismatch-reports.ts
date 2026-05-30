import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationMismatchReports1751100000000 implements MigrationInterface {
  name = 'AddObservationMismatchReports1751100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS observation_mismatch_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        observation_id uuid NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mismatch_type varchar(32) NOT NULL CHECK (
          mismatch_type IN ('unmeasurable_but_success', 'high_score_but_fail')
        ),
        message text NULL,
        status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
        reviewed_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_observation_mismatch_reports_observation_user
          UNIQUE (observation_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_observation_mismatch_reports_status_created
      ON observation_mismatch_reports(status, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_observation_mismatch_reports_status_created`);
    await queryRunner.query(`DROP TABLE IF EXISTS observation_mismatch_reports`);
  }
}
