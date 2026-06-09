import { MigrationInterface, QueryRunner } from 'typeorm';

/** 사용자 알림 내역 — MAIN 종 아이콘 조회용 */
export class AddNotificationHistory1751800000000 implements MigrationInterface {
  name = 'AddNotificationHistory1751800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type varchar(64) NOT NULL,
        title varchar(200) NOT NULL,
        body text NOT NULL,
        data jsonb NULL,
        read_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_history_user_created
      ON notification_history(user_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_history_user_unread
      ON notification_history(user_id)
      WHERE read_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_history`);
  }
}
