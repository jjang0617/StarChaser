import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - `weekly_top5`: 주간 랭킹 (마이그레이션 1748000000000에서 `weekly_top3`로 rename)
 * - `spot_star_index_daily`: 명소별 일별 Star-Index 스냅샷 (주간 평균 집계 입력)
 */
export class AddSpotStarIndexDaily1720050000000 implements MigrationInterface {
  name = 'AddSpotStarIndexDaily1720050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS weekly_top5 (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        week_start date NOT NULL,
        rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 5),
        spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
        avg_star_index numeric(5, 2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (week_start, rank)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_top5_week_rank
      ON weekly_top5 (week_start DESC, rank ASC)
    `);

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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS spot_star_index_daily`);
    await queryRunner.query(`DROP TABLE IF EXISTS weekly_top5`);
  }
}
