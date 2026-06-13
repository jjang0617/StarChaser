import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAstronomyEventNotifications1751300000000
  implements MigrationInterface
{
  name = 'RemoveAstronomyEventNotifications1751300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS astro_event_push_sent`);
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      DROP COLUMN IF EXISTS astronomy_event_alert_enabled
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_preferences
      ADD COLUMN IF NOT EXISTS astronomy_event_alert_enabled boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS astro_event_push_sent (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id varchar(128) NOT NULL,
        sent_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, event_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_astro_event_push_sent_event
      ON astro_event_push_sent(event_id)
    `);
  }
}
