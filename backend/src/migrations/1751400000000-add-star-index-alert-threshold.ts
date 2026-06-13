import { MigrationInterface, QueryRunner } from 'typeorm';

/** 사용자별 Star-Index 푸시 임계값 (80·85·90·95) */
export class AddStarIndexAlertThreshold1751400000000 implements MigrationInterface {
  name = 'AddStarIndexAlertThreshold1751400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      ADD COLUMN IF NOT EXISTS star_index_alert_threshold integer NOT NULL DEFAULT 90
    `);
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      ADD CONSTRAINT chk_star_index_alert_threshold
      CHECK (star_index_alert_threshold IN (80, 85, 90, 95))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      DROP CONSTRAINT IF EXISTS chk_star_index_alert_threshold
    `);
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      DROP COLUMN IF EXISTS star_index_alert_threshold
    `);
  }
}
