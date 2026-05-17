import type { StarIndexResponseDto } from './types/api';

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
