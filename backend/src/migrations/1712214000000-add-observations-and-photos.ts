import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObservationsAndPhotos1712214000000 implements MigrationInterface {
  name = 'AddObservationsAndPhotos1712214000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS observations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        spot_id uuid NULL REFERENCES spots(id) ON DELETE SET NULL,
        star_index_val smallint NOT NULL CHECK (star_index_val BETWEEN 0 AND 100),
        weather_snapshot jsonb NOT NULL,
        result varchar(16) NOT NULL CHECK (result IN ('success', 'partial', 'fail')),
        observed_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE observations
      ALTER COLUMN weather_snapshot SET NOT NULL
    `);

    // Star-Index 10변수 누락 방지: 점수 변수 10개를 weather_snapshot JSONB에 필수 보관
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'CHK_observations_weather_snapshot_required_keys'
        ) THEN
          ALTER TABLE observations
          ADD CONSTRAINT CHK_observations_weather_snapshot_required_keys
          CHECK (
            weather_snapshot ? 'cloud_score' AND
            weather_snapshot ? 'pm25_score' AND
            weather_snapshot ? 'light_pollution_score' AND
            weather_snapshot ? 'moon_effect_score' AND
            weather_snapshot ? 'humidity_score' AND
            weather_snapshot ? 'elevation_score' AND
            weather_snapshot ? 'wind_score' AND
            weather_snapshot ? 'visibility_score' AND
            weather_snapshot ? 'temperature_score' AND
            weather_snapshot ? 'correction_score'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_observations_user_observed_at
      ON observations(user_id, observed_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_observations_spot_observed_at
      ON observations(spot_id, observed_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        observation_id uuid NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
        image_url text NOT NULL,
        caption varchar(255),
        taken_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_photos_observation_id
      ON photos(observation_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_photos_created_at
      ON photos(created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_photos_created_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_photos_observation_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS photos`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_observations_spot_observed_at`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_observations_user_observed_at`);
    await queryRunner.query(`
      ALTER TABLE observations
      DROP CONSTRAINT IF EXISTS CHK_observations_weather_snapshot_required_keys
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS observations`);
  }
}
