/**
 * observations.weather_snapshot JSONB 표준 구조 (Star-Index 10변수)
 *
 * [크로스체크] A(장성재) / C(지영재) 합의 — 기준 파일: 본 파일
 * - 확정 키(필수, 10개): *_score 모두 0~100 정규화 점수
 * - observations.weather_snapshot(JSONB)에 10개 키 필수
 * - 누락 시 DB CHECK 제약으로 INSERT 실패 (마이그레이션 CHK_observations_weather_snapshot_required_keys)
 *
 * moon_effect_score: 달 위상·고도 반영 점수. 원시 moonAltitude(도)는 크로스체크용 선택 필드에만 저장.
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

  /** 강수확률(%) — 가중치 항목은 아니나 패널티(60% 이상) 추적용 */
  precipitation_probability?: number;

  /** C와 KASI 크로스체크용 — DB 필수 키 아님 */
  moon_altitude_deg?: number;
  /**
   * true면 KASI에서 고도 숫자를 읽음. false면 RiseSet에 고도 키 없음 등(값은 센티넬일 수 있음)
   * — DB 필수 키 아님
   */
  moon_altitude_known?: boolean;
  /** 달 위상 0~1 — DB 필수 키 아님 */
  lun_phase?: number;

  /** UI·카드 표시용 선택 필드(DB 제약 비대상) */
  cloud_sky_code?: number;
  cloud_sky_label?: string;
  cloud_cover_pct?: number;
  pm25_ug_m3?: number;
  pm25_label?: string;
  pm25_station_name?: string;
}

/** DB CHECK 및 Observation 저장 시 반드시 존재해야 하는 10개 점수 키 */
export const WEATHER_SNAPSHOT_SCORE_KEYS = [
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
] as const satisfies ReadonlyArray<keyof WeatherSnapshot>;

export type WeatherSnapshotScoreKey = (typeof WEATHER_SNAPSHOT_SCORE_KEYS)[number];

/** @deprecated WEATHER_SNAPSHOT_SCORE_KEYS 사용 권장 */
export const WEATHER_SNAPSHOT_REQUIRED_KEYS: WeatherSnapshotScoreKey[] = [
  ...WEATHER_SNAPSHOT_SCORE_KEYS,
];

export class WeatherSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeatherSnapshotValidationError';
  }
}

function clampScore0to100(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Observation 저장 전 런타임 검증 — DB 제약 전에 앱에서 명확한 메시지 제공
 */
export function assertValidWeatherSnapshotScores(
  value: unknown,
): asserts value is WeatherSnapshot {
  if (value === null || typeof value !== 'object') {
    throw new WeatherSnapshotValidationError('weather_snapshot은 객체여야 합니다.');
  }
  const o = value as Record<string, unknown>;
  for (const key of WEATHER_SNAPSHOT_SCORE_KEYS) {
    if (!(key in o)) {
      throw new WeatherSnapshotValidationError(`weather_snapshot 필수 키 누락: ${key}`);
    }
    const n = Number(o[key]);
    if (!Number.isFinite(n)) {
      throw new WeatherSnapshotValidationError(`weather_snapshot.${key}는 숫자여야 합니다.`);
    }
    if (n < 0 || n > 100) {
      throw new WeatherSnapshotValidationError(
        `weather_snapshot.${key}는 0~100 범위여야 합니다. (현재 ${n})`,
      );
    }
  }
}

/** 저장용: 10개 점수만 추출(클램프) + 선택 필드 유지 */
export function normalizeWeatherSnapshotForStorage(
  raw: WeatherSnapshot,
): WeatherSnapshot {
  const base: WeatherSnapshot = {
    cloud_score: clampScore0to100(raw.cloud_score),
    pm25_score: clampScore0to100(raw.pm25_score),
    light_pollution_score: clampScore0to100(raw.light_pollution_score),
    moon_effect_score: clampScore0to100(raw.moon_effect_score),
    humidity_score: clampScore0to100(raw.humidity_score),
    elevation_score: clampScore0to100(raw.elevation_score),
    wind_score: clampScore0to100(raw.wind_score),
    visibility_score: clampScore0to100(raw.visibility_score),
    temperature_score: clampScore0to100(raw.temperature_score),
    correction_score: clampScore0to100(raw.correction_score),
  };
  if (raw.precipitation_probability !== undefined) {
    base.precipitation_probability = raw.precipitation_probability;
  }
  if (raw.moon_altitude_deg !== undefined) {
    base.moon_altitude_deg = raw.moon_altitude_deg;
  }
  if (raw.moon_altitude_known !== undefined) {
    base.moon_altitude_known = raw.moon_altitude_known;
  }
  if (raw.lun_phase !== undefined) {
    base.lun_phase = raw.lun_phase;
  }
  if (raw.cloud_sky_code !== undefined) {
    base.cloud_sky_code = raw.cloud_sky_code;
  }
  if (raw.cloud_sky_label !== undefined) {
    base.cloud_sky_label = raw.cloud_sky_label;
  }
  if (raw.cloud_cover_pct !== undefined) {
    base.cloud_cover_pct = raw.cloud_cover_pct;
  }
  if (raw.pm25_ug_m3 !== undefined) {
    base.pm25_ug_m3 = raw.pm25_ug_m3;
  }
  if (raw.pm25_label !== undefined) {
    base.pm25_label = raw.pm25_label;
  }
  if (raw.pm25_station_name !== undefined) {
    base.pm25_station_name = raw.pm25_station_name;
  }
  return base;
}
