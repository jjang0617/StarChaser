/**
 * Star-Index v2 — 육안 관측 적합도
 * - 하위 점수: 비선형 곡선
 * - gate: 구름·강수·태양 고도 (곱셈)
 * - blend: 관측 핵심 요인 가중 합산
 */

import { applySunAltitudeToStarIndexScore } from './sun-observation-score.util';

/** gate·blend에 쓰는 관측 시각 기준 하위 점수 묶음 */
export type StarIndexComponentScores = {
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
  /** 강수형태·확률 기반 (0~100) — 스냅샷 선택 필드 */
  precipitation_score?: number;
};

export type StarIndexAggregateInput = {
  components: StarIndexComponentScores;
  cloudPercent: number;
  sunAltitudeDeg: number;
  pop: number;
  /** KMA PTY 0=없음, 1~7=강수 */
  pty: number;
  visibilityKnown: boolean;
};

/**
 * blend 합계 = 1.0 (시정 미수신 시 visibility → cloud로 이전)
 *
 * 가중치 재조정 (팀장 확정):
 * - pm25 0.10 → 0.13 : 겨울철 미세먼지 관측 실패를 더 강하게 반영
 * - elevation 0.027 → 0.04 : 고도 변별력 보강(보조 변수이므로 소폭만)
 * - humidity 0.018 → 0.038, visibility 0.018 → 0.029 : 과소평가됐던 투명도 계열 보강
 * - correction 0.074 → 0 : 사용자 제보는 로그/데이터로만 수집하고 점수 자동 반영은 비활성화.
 *   (제보 저장·집계 경로는 유지하되, 가중치 0으로 두어 실시간 점수에는 영향 없음.
 *    충분한 데이터가 쌓이면 사람이 검토 후 수동으로 가중치/지역 보정에 반영한다.)
 * 회수한 correction 0.074는 위 항목 상향(pm25 +0.03, elevation +0.013,
 * humidity +0.020, visibility +0.011)에 재분배하여 합계 1.0을 유지한다.
 */
const BLEND_WEIGHTS = {
  cloud: 0.273,
  light: 0.236,
  moon: 0.145,
  pm25: 0.13,
  precip: 0.073,
  wind: 0.036,
  elevation: 0.04,
  humidity: 0.038,
  visibility: 0.029,
  correction: 0,
} as const;

function clamp0to100(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * 구름량(%) → 천광 투과 gate (0~1)
 *
 * [의도된 보수 정책] 운량은 blend 가중치(cloud)에 더해 이 gate로도 곱셈 반영하는
 * 이중 반영 구조다. 운량은 별 관측 실패에 가장 직접적인 요인이므로, "실패를 줄이는
 * 보수적 점수" 정책에 따라 흐린 조건에서 점수가 강하게 낮아지도록 의도적으로 설계했다.
 */
export function cloudTransmittanceGate(cloudPercent: number): number {
  const c = Math.min(100, Math.max(0, cloudPercent));
  if (c >= 92) return 0.06;
  if (c >= 80) return 0.18;
  if (c >= 65) return 0.38;
  if (c >= 50) return 0.58;
  if (c >= 30) return 0.78;
  if (c >= 15) return 0.92;
  return 1;
}

/**
 * 강수 gate — PTY 우선, POP 보조
 *
 * [의도된 보수 정책] 강수도 blend 가중치(precip)에 더해 이 gate로 곱셈 반영하는
 * 이중 반영 구조다. 비/눈(PTY) 발생 시 관측은 거의 실패에 가까우므로 강하게 감점한다
 * (PTY 발생 시 0.05). POP 낮은 구간의 추가 조정은 추후 샘플 점수를 보고 판단한다.
 */
export function precipitationGate(pty: number, pop: number): number {
  const ptyN = Math.round(pty);
  if (ptyN >= 1 && ptyN <= 7) return 0.05;

  const popN = Math.min(100, Math.max(0, pop));
  if (popN >= 80) return 0.1;
  if (popN >= 60) return 0.22;
  if (popN >= 40) return 0.42;
  if (popN >= 20) return 0.68;
  return 1;
}

function blendWeights(visibilityKnown: boolean): {
  cloud: number;
  light: number;
  moon: number;
  pm25: number;
  precip: number;
  wind: number;
  elevation: number;
  humidity: number;
  visibility: number;
  correction: number;
} {
  const w = { ...BLEND_WEIGHTS };
  if (!visibilityKnown) {
    return {
      ...w,
      cloud: w.cloud + w.visibility,
      visibility: 0,
    };
  }
  return { ...w };
}

/**
 * 가중 blend + 구름·강수 gate + 태양 고도 보정 → 최종 0~100
 */
export function aggregateStarIndexScore(input: StarIndexAggregateInput): number {
  const { components, cloudPercent, sunAltitudeDeg, pop, pty, visibilityKnown } =
    input;
  const w = blendWeights(visibilityKnown);

  const precipComponent =
    components.precipitation_score ??
    calcPrecipitationScore(pty, pop);

  let blend =
    components.cloud_score * w.cloud +
    components.light_pollution_score * w.light +
    components.moon_effect_score * w.moon +
    components.pm25_score * w.pm25 +
    precipComponent * w.precip +
    components.wind_score * w.wind +
    components.elevation_score * w.elevation +
    components.humidity_score * w.humidity +
    components.correction_score * w.correction;

  if (visibilityKnown && w.visibility > 0) {
    blend += components.visibility_score * w.visibility;
  }

  const cloudG = cloudTransmittanceGate(cloudPercent);
  const precipG = precipitationGate(pty, pop);
  let score = blend * cloudG * precipG;

  score = applySunAltitudeToStarIndexScore(score, sunAltitudeDeg);
  return clamp0to100(score);
}

// ── 하위 점수 (비선형) ─────────────────────────────────────────

export function calcCloudScore(cloudPercent: number): number {
  const c = Math.min(100, Math.max(0, cloudPercent));
  if (c <= 12) return 100;
  if (c <= 25) return 92;
  if (c <= 40) return 78;
  if (c <= 55) return 58;
  if (c <= 70) return 35;
  if (c <= 85) return 15;
  return 5;
}

export function calcLightPollutionScore(bortleClass: number): number {
  const b = Math.min(9, Math.max(1, Math.round(bortleClass)));
  const table: Record<number, number> = {
    1: 100,
    2: 96,
    3: 88,
    4: 78,
    5: 65,
    6: 48,
    7: 32,
    8: 18,
    9: 8,
  };
  return table[b] ?? 50;
}

/**
 * 달 위상·고도 → 하늘 밝기 피해 (astronomy-engine phase_fraction 기준)
 */
export function calcMoonEffectScore(
  phaseFraction: number,
  altitudeDeg: number,
  altitudeKnown = true,
  altitudeMissingSentinel = -10,
): number {
  if (
    altitudeKnown === false ||
    (altitudeKnown === undefined && altitudeDeg === altitudeMissingSentinel)
  ) {
    return 100;
  }
  if (altitudeDeg < 0) return 100;

  const phase = Math.min(1, Math.max(0, phaseFraction));
  const alt = Math.min(90, Math.max(0, altitudeDeg));
  const altFactor = Math.pow(alt / 90, 0.82);
  const skyGlow = phase * altFactor;
  return clamp0to100(100 * (1 - 0.94 * skyGlow));
}

export function calcPm25Score(pm25: number): number {
  if (pm25 <= 8) return 100;
  if (pm25 <= 15) return 92;
  if (pm25 <= 25) return 78;
  if (pm25 <= 35) return 62;
  if (pm25 <= 50) return 42;
  if (pm25 <= 75) return 22;
  return 5;
}

/** 고습만 연무 보조 감점 (PM2.5와 중복 최소화) */
export function calcHumidityHazeScore(humidity: number, pm25: number): number {
  if (humidity <= 72) return 100;
  if (humidity >= 96) return pm25 > 25 ? 35 : 55;
  const t = (humidity - 72) / 24;
  const base = Math.round(100 - t * 45);
  if (pm25 > 35) return Math.min(base, 50);
  return base;
}

export function calcElevationScore(elevationM: number): number {
  const m = Math.max(0, elevationM);
  if (m >= 1200) return 100;
  if (m >= 800) return 92;
  if (m >= 500) return 82;
  if (m >= 200) return 70;
  if (m >= 80) return 58;
  return 48;
}

/** 바람 → 시야 흔들림(seeing) */
export function calcWindSeeingScore(windSpeed: number): number {
  const w = Math.max(0, windSpeed);
  if (w <= 3) return 100;
  if (w <= 5) return 88;
  if (w <= 7) return 68;
  if (w <= 10) return 42;
  if (w <= 14) return 20;
  return 5;
}

export function calcVisibilityScore(visibilityKm: number, known: boolean): number {
  if (!known) return 100;
  const v = visibilityKm;
  if (v >= 20) return 100;
  if (v >= 12) return 90;
  if (v >= 8) return 75;
  if (v >= 5) return 48;
  if (v >= 3) return 25;
  return 8;
}

/**
 * 기온 점수 — 항상 100(중립). 관측 본점수에는 반영하지 않는다.
 *
 * [의도] 기온은 관측 성공률보다 사용자 체감·안전 요소에 가깝다. MVP에서는 StarIndex
 * 본점수에 반영하지 않고 중립(100) 처리하며, weather_snapshot 10키 스키마 호환을 위해
 * 키 자체는 유지한다.
 */
export function calcTemperatureNeutralScore(): number {
  return 100;
}

export function calcPrecipitationScore(pty: number, pop: number): number {
  const gate = precipitationGate(pty, pop);
  return clamp0to100(gate * 100);
}

export function parseObservationTime(atRaw?: string): Date | undefined {
  if (!atRaw?.trim()) return undefined;
  const d = new Date(atRaw.trim());
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}
