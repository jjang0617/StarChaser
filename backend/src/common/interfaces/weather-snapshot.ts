/**
 * observations.weather_snapshot JSONB 표준 구조 (Phase 1.5)
 * - Star-Index 10변수 점수 스냅샷을 누락 없이 보관한다.
 * - 점수 범위는 서비스 로직에서 0~100으로 정규화해 저장한다.
 */
export interface WeatherSnapshot {
  cloud_score: number;
  pm25_score: number;
  light_pollution_score: number;
  moon_effect_score: number;
  humidity_score: number;
  elevation_score: number;
  wind_score: number;
  visibility_score: number;
  temperature_score: number;
  correction_score: number;

  // 강수 확률은 10변수 가중치 항목은 아니지만 패널티 계산 추적용으로 보관한다.
  precipitation_probability?: number;
}

export const WEATHER_SNAPSHOT_REQUIRED_KEYS: Array<keyof WeatherSnapshot> = [
  'cloud_score',
  'pm25_score',
  'light_pollution_score',
  'moon_effect_score',
  'humidity_score',
  'elevation_score',
  'wind_score',
  'visibility_score',
  'temperature_score',
  'correction_score',
];
