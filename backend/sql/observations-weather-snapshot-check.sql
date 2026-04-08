-- observations.weather_snapshot JSONB — Star-Index 10점수 키 필수 (A/C 합의)
-- TypeORM 마이그레이션을 쓰지 않는 Supabase에서만 수동 실행

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CHK_observations_weather_snapshot_required_keys'
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
