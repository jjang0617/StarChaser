import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpotReports1751200000000 implements MigrationInterface {
  name = 'AddSpotReports1751200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spot_reports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        latitude double precision NOT NULL,
        longitude double precision NOT NULL,
        message text NOT NULL,
        star_index_val smallint NOT NULL CHECK (star_index_val BETWEEN 0 AND 100),
        weather_snapshot jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_spot_reports_created_at
      ON spot_reports(created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_spot_reports_created_at`);
    await queryRunner.query(`DROP TABLE IF EXISTS spot_reports`);
  }
}
