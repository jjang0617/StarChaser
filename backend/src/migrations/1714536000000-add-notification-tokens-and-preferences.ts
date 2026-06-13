import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationTokensAndPreferences1714536000000
  implements MigrationInterface
{
  name = 'AddNotificationTokensAndPreferences1714536000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fcm_token text NOT NULL UNIQUE,
        platform varchar(16) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_tokens_user_id
      ON notification_tokens(user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        alerts_enabled boolean NOT NULL DEFAULT true,
        star_index_alert_enabled boolean NOT NULL DEFAULT true,
        astronomy_event_alert_enabled boolean NOT NULL DEFAULT true,
        top5_alert_enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_preferences`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_notification_tokens_user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS notification_tokens`);
  }
}
