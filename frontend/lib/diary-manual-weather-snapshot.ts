import type { WeatherSnapshotDto } from './types/api';

/** 작성자가 직접 입력한 Star-Index — API 필수 weather_snapshot 키 채움 */
export function weatherSnapshotForManualDiaryScore(
  score: number,
): WeatherSnapshotDto {
  const s = Math.min(100, Math.max(0, Math.round(score)));
  return {
    cloud_score: s,
    pm25_score: s,
    light_pollution_score: s,
    moon_effect_score: s,
    humidity_score: s,
    elevation_score: s,
    wind_score: s,
    visibility_score: s,
    temperature_score: s,
    correction_score: s,
  };
}
