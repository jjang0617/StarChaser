import { getStarIndexScoreDisplay } from './star-index-display';

/** Star-Index 50 미만이면 UI상 측정불가 */
export const STAR_INDEX_MEASURABLE_MIN = 50;

/** “점수가 높음” 판정 기준 */
export const STAR_INDEX_HIGH_SCORE_THRESHOLD = 70;

export type ObservationMismatchType =
  | 'unmeasurable_but_success'
  | 'high_score_but_fail';

export function detectObservationMismatch(
  starIndexVal: number,
  result: 'success' | 'partial' | 'fail',
): ObservationMismatchType | null {
  const si = getStarIndexScoreDisplay(starIndexVal);
  if (!si.measurable && result === 'success') {
    return 'unmeasurable_but_success';
  }
  if (
    si.measurable &&
    starIndexVal >= STAR_INDEX_HIGH_SCORE_THRESHOLD &&
    result === 'fail'
  ) {
    return 'high_score_but_fail';
  }
  return null;
}

export function mismatchHint(type: ObservationMismatchType): string {
  if (type === 'unmeasurable_but_success') {
    return 'Star-Index는 측정불가인데 관측 결과가 성공으로 기록되어 있습니다. 실제 관측과 점수가 다르다면 제보해 주세요.';
  }
  return 'Star-Index 점수는 높은 편인데 관측 결과가 실패로 기록되어 있습니다. 실제 관측과 점수가 다르다면 제보해 주세요.';
}

export function mismatchTypeLabel(type: ObservationMismatchType): string {
  if (type === 'unmeasurable_but_success') {
    return '측정불가 · 관측 성공';
  }
  return '높은 점수 · 관측 실패';
}
