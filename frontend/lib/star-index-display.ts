import { humidityLabelFromScore } from './star-index-headline';
import type { StarIndexResponseDto } from './types/api';

/**
 * 이 값 미만이면 별 관측이 어려운 저점수 구간. UI에는 다른 구간과 동일하게 점수 숫자만 표시하고,
 * 차이는 색·게이지 등 보조 스타일(measurable 플래그)로만 구분한다.
 * '관측 어려움' 등 상태 라벨은 가이드 시트(MainScoreGuideSheet)에만 노출한다.
 */
export const STAR_INDEX_DISPLAY_MIN_SCORE = 50;

export type StarIndexScoreDisplay = {
  measurable: boolean;
  label: string;
  gaugePercent: number;
};

export function getStarIndexScoreDisplay(score: number): StarIndexScoreDisplay {
  const n = Math.round(score);
  const finite = Number.isFinite(n);
  const clamped = Math.min(100, Math.max(0, finite ? n : 0));
  return {
    measurable: finite && n >= STAR_INDEX_DISPLAY_MIN_SCORE,
    /** 모든 구간 숫자만 — 50점 미만도 예외 없이 원점수 그대로 */
    label: finite ? String(n) : '—',
    gaugePercent: clamped,
  };
}

const SKY_LABEL_KO: Record<number, string> = {
  1: '맑음',
  2: '구름조금',
  3: '구름많음',
  4: '흐림',
};

function skyCodeFromCloudPercent(pct: number): number {
  if (pct <= 20) return 1;
  if (pct <= 45) return 2;
  if (pct <= 75) return 3;
  return 4;
}

function approximateCloudCoverPercent(cloudScore: number): number {
  return Math.min(100, Math.max(0, 100 - Math.round(cloudScore)));
}

function coerceFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function formatCloudForCard(
  snap: StarIndexResponseDto['weatherSnapshot'],
): string {
  const label = snap.cloud_sky_label?.trim();
  if (label) return label;

  const code = snap.cloud_sky_code;
  if (code !== undefined && Number.isFinite(code)) {
    const rounded = Math.round(code);
    return SKY_LABEL_KO[rounded] ?? '구름많음';
  }

  const pct =
    snap.cloud_cover_pct !== undefined
      ? snap.cloud_cover_pct
      : approximateCloudCoverPercent(snap.cloud_score);
  return SKY_LABEL_KO[skyCodeFromCloudPercent(pct)] ?? '구름많음';
}

export function pm25LevelFromUgM3(pm25: number): string {
  if (pm25 <= 15) return '좋음';
  if (pm25 <= 35) return '보통';
  if (pm25 <= 75) return '나쁨';
  return '매우나쁨';
}

/** MAIN 하단 PM2.5 칩 — 수치 + 등급 분리 */
export function formatPm25Stat(
  snap: StarIndexResponseDto['weatherSnapshot'],
  displayOverride?: string,
): { value: string; grade: string } {
  const pm25Raw = coerceFiniteNumber(snap.pm25_ug_m3);
  if (pm25Raw !== undefined) {
    const num =
      Math.abs(pm25Raw - Math.round(pm25Raw)) < 0.05
        ? String(Math.round(pm25Raw))
        : pm25Raw.toFixed(1);
    const grade =
      snap.pm25_label?.trim() || pm25LevelFromUgM3(pm25Raw);
    return { value: `${num} µg/m³`, grade };
  }

  const fromDisplay = displayOverride?.trim();
  if (fromDisplay) {
    const ugMatch = fromDisplay.match(/([\d.]+)\s*㎍/);
    if (ugMatch) {
      const n = Number(ugMatch[1]);
      const grade =
        fromDisplay.replace(/[\d.]+\s*㎍\/㎥/g, '').replace(/[·\s]+/g, ' ').trim() ||
        (Number.isFinite(n) ? pm25LevelFromUgM3(n) : '—');
      return {
        value: `${ugMatch[1]} µg/m³`,
        grade: grade || pm25LevelFromUgM3(n),
      };
    }
    return { value: '—', grade: fromDisplay };
  }

  const grade =
    snap.pm25_label?.trim() ||
    pm25LevelFromUgM3(
      snap.pm25_score >= 100 ? 10 : snap.pm25_score >= 75 ? 20 : 50,
    );
  return { value: '—', grade };
}

export function formatPm25ForCard(
  snap: StarIndexResponseDto['weatherSnapshot'],
): string {
  const station = snap.pm25_station_name?.trim();
  const pm25Raw = coerceFiniteNumber(snap.pm25_ug_m3);
  if (pm25Raw !== undefined) {
    const value =
      Math.abs(pm25Raw - Math.round(pm25Raw)) < 0.05
        ? `${Math.round(pm25Raw)}`
        : pm25Raw.toFixed(1);
    const core = `${value}㎍/㎥`;
    return station ? `${core}·${station}` : core;
  }
  const grade =
    snap.pm25_label?.trim() ||
    pm25LevelFromUgM3(
      snap.pm25_score >= 100 ? 10 : snap.pm25_score >= 75 ? 20 : 50,
    );
  return station ? `${grade}·${station}` : grade;
}

export function starIndexResponseToCardModel(d: StarIndexResponseDto) {
  const snap = d.weatherSnapshot;
  const pm25Ug = coerceFiniteNumber(snap.pm25_ug_m3);
  const snapForFormat =
    pm25Ug !== undefined ? { ...snap, pm25_ug_m3: pm25Ug } : snap;

  const pm25Info = formatPm25Stat(snapForFormat, d.display?.pm25?.trim());

  return {
    score: d.score,
    sunAltLabel: snap.sun_altitude_deg != null ? `${Math.round(snap.sun_altitude_deg)}°` : '—',
    lightPollutionLabel: `Bortle ${d.bortleClass}급`,
    cloudLabel: d.display?.cloud?.trim() || formatCloudForCard(snapForFormat),
    moonAltLabel: snap.moon_altitude_deg != null && snap.moon_altitude_known !== false
      ? `${Math.round(snap.moon_altitude_deg)}°`
      : '—',
    humidityLabel: humidityLabelFromScore(snap.humidity_score),
    pm25Level: pm25Info.value,
  };
}
