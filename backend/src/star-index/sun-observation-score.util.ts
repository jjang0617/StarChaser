/**
 * 태양 고도(°)에 따른 Star-Index 조정.
 * - 한낮: 총점 상한을 낮추되 구름·PM2.5 등 지역 차이는 남김
 * - 박명/밤: 점차·완전히 반영
 */

/**
 * UI용 0~100 (100 = 완전한 밤)
 * 본점수 multiplier(applySunAltitudeToStarIndexScore)에 100을 적용한 값과 동일하게
 * 맞춰, 표시용 점수와 실제 점수의 박명대 거동(단조 감소·경계 연속)을 일치시킨다.
 * (이전 구현은 태양이 높아질수록 값이 커지는 역방향 + 경계 불연속 버그가 있었다.)
 */
export function sunAltitudeToObservationScore(sunAltDeg: number): number {
  if (sunAltDeg < -18) return 100;
  return Math.round(applySunAltitudeToStarIndexScore(100, sunAltDeg));
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

  // 박명 구간(-18°~0°)은 태양이 높아질수록(하늘이 밝아질수록) multiplier가
  // 단조 감소해야 한다. 앵커: -18°=1.00, -12°=0.75, -6°=0.45, 0°=0.15
  // 각 경계에서 양쪽 식의 값이 일치하도록 맞춰 불연속(점프)을 제거했다.
  if (sunAltDeg >= -6) {
    // -6° → 0° : 0.45 → 0.15
    const t = (sunAltDeg + 6) / 6;
    const mult = 0.45 - t * 0.3;
    return Math.round(Math.min(100, base * mult));
  }

  if (sunAltDeg >= -12) {
    // -12° → -6° : 0.75 → 0.45
    const t = (sunAltDeg + 12) / 6;
    const mult = 0.75 - t * 0.3;
    return Math.round(Math.min(100, base * mult));
  }

  if (sunAltDeg >= -18) {
    // -18° → -12° : 1.00 → 0.75
    const t = (sunAltDeg + 18) / 6;
    const mult = 1.0 - t * 0.25;
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
