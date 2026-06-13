import { MigrationInterface, QueryRunner } from 'typeorm';

/** 일기 — 측정 시각 SI vs 본인이 느낀 점수 불일치 제보 */
export class AddFeltScoreMismatchType1751600000000 implements MigrationInterface {
  name = 'AddFeltScoreMismatchType1751600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE observation_mismatch_reports
      DROP CONSTRAINT IF EXISTS observation_mismatch_reports_mismatch_type_check
    `);
    await queryRunner.query(`
      ALTER TABLE observation_mismatch_reports
      ADD CONSTRAINT observation_mismatch_reports_mismatch_type_check
      CHECK (
        mismatch_type IN (
          'unmeasurable_but_success',
          'high_score_but_fail',
          'felt_score_differs'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM observation_mismatch_reports
      WHERE mismatch_type = 'felt_score_differs'
    `);
    await queryRunner.query(`
      ALTER TABLE observation_mismatch_reports
      DROP CONSTRAINT IF EXISTS observation_mismatch_reports_mismatch_type_check
    `);
    await queryRunner.query(`
      ALTER TABLE observation_mismatch_reports
      ADD CONSTRAINT observation_mismatch_reports_mismatch_type_check
      CHECK (
        mismatch_type IN ('unmeasurable_but_success', 'high_score_but_fail')
      )
    `);
  }
}
