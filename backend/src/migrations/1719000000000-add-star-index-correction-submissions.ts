import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStarIndexCorrectionSubmissions1719000000000
  implements MigrationInterface
{
  name = 'AddStarIndexCorrectionSubmissions1719000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS star_index_correction_submissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        perceived_quality smallint NOT NULL
          CHECK (perceived_quality BETWEEN 0 AND 100),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_star_index_correction_spot_created
      ON star_index_correction_submissions(spot_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS star_index_correction_submissions
    `);
  }
}
