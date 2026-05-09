import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlertSpotStarIndexPushSent1735000000000
  implements MigrationInterface
{
  name = 'AddAlertSpotStarIndexPushSent1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      ADD COLUMN IF NOT EXISTS alert_spot_id uuid NULL
      REFERENCES spots(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS star_index_push_sent (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
        sent_day_kst date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id, spot_id, sent_day_kst)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_star_index_push_sent_day
      ON star_index_push_sent(sent_day_kst)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS star_index_push_sent`);
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      DROP COLUMN IF EXISTS alert_spot_id
    `);
  }
}
