import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 주간 TOP3 기능 제거 — 랭킹·일별 스냅샷 테이블 및 알림 설정 컬럼 삭제.
 */
export class RemoveWeeklyTop31751700000000 implements MigrationInterface {
  name = 'RemoveWeeklyTop31751700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS weekly_top3`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_star_index_daily`);

    const hasCol = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notification_preferences'
        AND column_name = 'top3_alert_enabled'
    `);
    if (Array.isArray(hasCol) && hasCol.length > 0) {
      await queryRunner.query(`
        ALTER TABLE notification_preferences
        DROP COLUMN top3_alert_enabled
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_star_index_daily (
        spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
        day date NOT NULL,
        score numeric(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (spot_id, day)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_spot_star_index_daily_day
      ON spot_star_index_daily (day)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS weekly_top3 (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        week_start date NOT NULL,
        rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 3),
        spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
        avg_star_index numeric(5, 2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (week_start, rank)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_top3_week_rank
      ON weekly_top3 (week_start DESC, rank ASC)
    `);

    const hasCol = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notification_preferences'
        AND column_name = 'top3_alert_enabled'
    `);
    if (!Array.isArray(hasCol) || hasCol.length === 0) {
      await queryRunner.query(`
        ALTER TABLE notification_preferences
        ADD COLUMN top3_alert_enabled boolean NOT NULL DEFAULT true
      `);
    }
  }
}
