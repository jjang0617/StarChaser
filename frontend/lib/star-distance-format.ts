/** 1 광년 ≈ AU (IAU 근사) */
const AU_PER_LY = 63241.077088;

export function lightYearsToAu(ly: number): number {
  return ly * AU_PER_LY;
}

/** 천체 카드용 — 광년 + AU 환산 (별 거리는 AU가 매우 크므로 둘 다 표시) */
export function formatStarDistanceLyAu(distanceLy: number | null | undefined): string {
  if (distanceLy == null || !Number.isFinite(distanceLy)) {
    return '알려진 거리 자료가 없습니다.';
  }
  const au = lightYearsToAu(distanceLy);
  let auPart: string;
  if (au >= 1e8) {
    auPart = `약 ${(au / 1e8).toFixed(2)}×10⁸ AU`;
  } else if (au >= 1e6) {
    auPart = `약 ${(au / 1e6).toFixed(2)}×10⁶ AU`;
  } else if (au >= 1e4) {
    auPart = `약 ${(au / 1e3).toFixed(1)}×10³ AU`;
  } else {
    auPart = `약 ${Math.round(au).toLocaleString('ko-KR')} AU`;
  }
  const lyStr =
    distanceLy < 10 && distanceLy !== Math.round(distanceLy)
      ? distanceLy.toFixed(2)
      : Math.round(distanceLy).toLocaleString('ko-KR');
  return `지구까지 약 ${lyStr} 광년 (시선 거리를 AU로 환산하면 ≈ ${auPart}; 1 AU ≈ 태양–지구 거리)`;
}
