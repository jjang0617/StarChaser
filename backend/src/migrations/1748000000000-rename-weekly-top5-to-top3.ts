import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 주간 랭킹·알림 설정 명칭 TOP5 → TOP3 정합.
 */
export class RenameWeeklyTop5ToTop31748000000000
  implements MigrationInterface
{
  name = 'RenameWeeklyTop5ToTop31748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTop5 = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'weekly_top5'
    `);
    if (Array.isArray(hasTop5) && hasTop5.length > 0) {
      await queryRunner.query(`ALTER TABLE weekly_top5 RENAME TO weekly_top3`);
      await queryRunner.query(`
        ALTER INDEX IF EXISTS idx_weekly_top5_week_rank
        RENAME TO idx_weekly_top3_week_rank
      `);
    }

    const hasTop3 = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'weekly_top3'
    `);
    if (Array.isArray(hasTop3) && hasTop3.length > 0) {
      await queryRunner.query(`DELETE FROM weekly_top3 WHERE rank > 3`);
    }

    const hasTop5Col = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notification_preferences'
        AND column_name = 'top5_alert_enabled'
    `);
    if (Array.isArray(hasTop5Col) && hasTop5Col.length > 0) {
      await queryRunner.query(`
        ALTER TABLE notification_preferences
        RENAME COLUMN top5_alert_enabled TO top3_alert_enabled
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTop3Col = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notification_preferences'
        AND column_name = 'top3_alert_enabled'
    `);
    if (Array.isArray(hasTop3Col) && hasTop3Col.length > 0) {
      await queryRunner.query(`
        ALTER TABLE notification_preferences
        RENAME COLUMN top3_alert_enabled TO top5_alert_enabled
      `);
    }

    const hasTop3 = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'weekly_top3'
    `);
    if (Array.isArray(hasTop3) && hasTop3.length > 0) {
      await queryRunner.query(`
        ALTER INDEX IF EXISTS idx_weekly_top3_week_rank
        RENAME TO idx_weekly_top5_week_rank
      `);
      await queryRunner.query(`ALTER TABLE weekly_top3 RENAME TO weekly_top5`);
    }
  }
}
