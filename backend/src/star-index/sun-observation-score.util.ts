/**
 * 태양 고도(°)에 따른 Star-Index 조정.
 * - 한낮: 총점 상한을 낮추되 구름·PM2.5 등 지역 차이는 남김
 * - 박명/밤: 점차·완전히 반영
 */

/** UI용 0~100 (100 = 완전한 밤) */
export function sunAltitudeToObservationScore(sunAltDeg: number): number {
  if (sunAltDeg < -18) return 100;
  if (sunAltDeg >= 0) {
    const sample = applySunAltitudeToStarIndexScore(100, sunAltDeg);
    return Math.round(sample);
  }
  if (sunAltDeg >= -6) {
    const t = (sunAltDeg + 6) / 6;
    return Math.round(8 + t * 35);
  }
  if (sunAltDeg >= -12) {
    const t = (sunAltDeg + 12) / 6;
    return Math.round(43 + t * 32);
  }
  const t = (sunAltDeg + 18) / 6;
  return Math.round(75 + t * 25);
}

/**
 * 기상·광공해 등으로 산출한 baseScore(0~100)에 태양 고도 반영.
 */
export function applySunAltitudeToStarIndexScore(
  baseScore: number,
  sunAltDeg: number,
): number {
  const base = Math.min(100, Math.max(0, baseScore));

  if (sunAltDeg < -18) {
    return Math.round(base);
  }

  if (sunAltDeg >= 10) {
    return Math.round(Math.min(8, Math.max(0, base * 0.08)));
  }

  if (sunAltDeg >= 0) {
    const t = (10 - sunAltDeg) / 10;
    const cap = 8 + t * 6;
    const scale = 0.08 + t * 0.07;
    return Math.round(Math.min(cap, base * scale));
  }

  if (sunAltDeg >= -6) {
    const t = (sunAltDeg + 6) / 6;
    const mult = 0.45 - t * 0.3;
    return Math.round(Math.min(100, base * mult));
  }

  if (sunAltDeg >= -12) {
    const t = (sunAltDeg + 12) / 6;
    const mult = 0.43 + t * 0.32;
    return Math.round(Math.min(100, base * mult));
  }

  if (sunAltDeg >= -18) {
    const t = (sunAltDeg + 18) / 6;
    const mult = 0.75 + t * 0.25;
    return Math.round(Math.min(100, base * mult));
  }

  return Math.round(base);
}

/** @deprecated 내부 호환 — applySunAltitudeToStarIndexScore 사용 */
export function sunAltitudeToScoreMultiplier(sunAltDeg: number): number {
  if (sunAltDeg < -18) return 1;
  const adjusted = applySunAltitudeToStarIndexScore(100, sunAltDeg);
  return adjusted / 100;
}
