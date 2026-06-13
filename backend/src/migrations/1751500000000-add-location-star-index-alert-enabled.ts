import { MigrationInterface, QueryRunner } from 'typeorm';

/** MAIN·ME — 위치한 곳 Star-Index 푸시 (기준 명소와 별도) */
export class AddLocationStarIndexAlertEnabled1751500000000 implements MigrationInterface {
  name = 'AddLocationStarIndexAlertEnabled1751500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      ADD COLUMN IF NOT EXISTS location_star_index_alert_enabled boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      DROP COLUMN IF EXISTS location_star_index_alert_enabled
    `);
  }
}
