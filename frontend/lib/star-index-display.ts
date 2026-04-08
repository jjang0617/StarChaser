import type { StarIndexResponseDto } from './types/api';

/** cloud_score = max(0, 100 - cloud%) 역산 (표시용 근사) */
export function approximateCloudCoverPercent(cloudScore: number): number {
  return Math.min(100, Math.max(0, 100 - Math.round(cloudScore)));
}

export function pm25LevelFromScore(pm25Score: number): string {
  if (pm25Score >= 75) return '좋음';
  if (pm25Score >= 45) return '보통';
  return '나쁨';
}

export function starIndexResponseToCardModel(d: StarIndexResponseDto) {
  const snap = d.weatherSnapshot;
  return {
    score: d.score,
    cloudCover: approximateCloudCoverPercent(snap.cloud_score),
    pm25Level: pm25LevelFromScore(snap.pm25_score),
    moonAltitude: snap.moon_altitude_deg ?? 0,
    moonAltitudeKnown: snap.moon_altitude_known !== false,
  };
}
