import { MigrationInterface, QueryRunner } from 'typeorm';

/** 위치한 곳 Star-Index 푸시 — 마지막 관측 좌표·일 단위 중복 방지 */
export class AddLocationStarIndexPush1751900000000 implements MigrationInterface {
  name = 'AddLocationStarIndexPush1751900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      ADD COLUMN IF NOT EXISTS last_observer_lat double precision NULL,
      ADD COLUMN IF NOT EXISTS last_observer_lng double precision NULL,
      ADD COLUMN IF NOT EXISTS last_observer_place_label varchar(120) NULL,
      ADD COLUMN IF NOT EXISTS last_observer_at timestamptz NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS location_star_index_push_sent (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sent_day_kst date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id, sent_day_kst)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_location_star_index_push_sent_day
      ON location_star_index_push_sent(sent_day_kst)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS location_star_index_push_sent`);
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      DROP COLUMN IF EXISTS last_observer_at,
      DROP COLUMN IF EXISTS last_observer_place_label,
      DROP COLUMN IF EXISTS last_observer_lng,
      DROP COLUMN IF EXISTS last_observer_lat
    `);
  }
}
