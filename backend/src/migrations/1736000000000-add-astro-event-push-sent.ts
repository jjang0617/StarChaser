import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAstroEventPushSent1736000000000 implements MigrationInterface {
  name = 'AddAstroEventPushSent1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS astro_event_push_sent (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id, event_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_astro_event_push_sent_event
      ON astro_event_push_sent(event_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS astro_event_push_sent`);
  }
}
