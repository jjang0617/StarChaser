import type { StarIndexResponseDto } from './types/api';

/** 가중 합산 점수가 이 값 미만이면 UI에 측정불가(점수) 표시 */
export const STAR_INDEX_DISPLAY_MIN_SCORE = 50;

export type StarIndexScoreDisplay = {
  measurable: boolean;
  label: string;
  gaugePercent: number;
};

/** 50점 미만 — 원점수를 괄호에 표시 (예: 측정불가(42)) */
export function formatUnmeasurableStarIndexLabel(score: number): string {
  const n = Math.round(score);
  if (!Number.isFinite(n)) return '측정불가';
  return `측정불가(${n})`;
}

export function getStarIndexScoreDisplay(score: number): StarIndexScoreDisplay {
  const n = Math.round(score);
  if (!Number.isFinite(n) || n < STAR_INDEX_DISPLAY_MIN_SCORE) {
    const clamped = Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
    return {
      measurable: false,
      label: formatUnmeasurableStarIndexLabel(score),
      /** 측정불가여도 MAIN 링·게이지는 원점수 비율로 표시 */
      gaugePercent: clamped,
    };
  }
  return {
    measurable: true,
    label: String(n),
    gaugePercent: Math.min(100, Math.max(0, n)),
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

  return {
    score: d.score,
    cloudLabel: d.display?.cloud?.trim() || formatCloudForCard(snapForFormat),
    pm25Level: d.display?.pm25?.trim() || formatPm25ForCard(snapForFormat),
    moonAltitude: Math.round(snap.moon_altitude_deg ?? 0),
    moonAltitudeKnown: snap.moon_altitude_known !== false,
  };
}
