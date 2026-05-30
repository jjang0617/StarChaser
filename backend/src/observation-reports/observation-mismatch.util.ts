/** Star-Index 50 미만이면 UI상 측정불가 */
export const STAR_INDEX_MEASURABLE_MIN = 50;

/** “점수가 높음” 판정 기준 */
export const STAR_INDEX_HIGH_SCORE_THRESHOLD = 70;

export type ObservationMismatchType =
  | 'unmeasurable_but_success'
  | 'high_score_but_fail';

export function isStarIndexMeasurable(score: number): boolean {
  const n = Math.round(score);
  return Number.isFinite(n) && n >= STAR_INDEX_MEASURABLE_MIN;
}

/** 일기의 Star-Index·관측 결과 불일치 여부 */
export function detectObservationMismatch(
  starIndexVal: number,
  result: 'success' | 'partial' | 'fail',
): ObservationMismatchType | null {
  if (!isStarIndexMeasurable(starIndexVal) && result === 'success') {
    return 'unmeasurable_but_success';
  }
  if (
    isStarIndexMeasurable(starIndexVal) &&
    starIndexVal >= STAR_INDEX_HIGH_SCORE_THRESHOLD &&
    result === 'fail'
  ) {
    return 'high_score_but_fail';
  }
  return null;
}

export function mismatchTypeLabel(type: ObservationMismatchType): string {
  if (type === 'unmeasurable_but_success') {
    return '측정불가인데 관측 성공';
  }
  return '높은 점수인데 관측 실패';
}
