/** 서버 STAR_INDEX_ALERT_THRESHOLD 와 동일하게 유지 */
export const STAR_INDEX_PUSH_THRESHOLD = 90;

/** ME · 위치한 곳 알림 — 임계값은 하나만 저장됨 (MAIN·ME 공통) */
export function locationStarIndexAlertMeSubtitle(
  threshold: number,
  enabled: boolean,
): string {
  if (!enabled) {
    return '위치한 곳 점수가 선택한 기준을 넘으면 하루 1회 알려 드려요';
  }
  return `위치한 곳 점수가 ${threshold}점 이상이면 하루 1회 알려 드려요`;
}

export const LOCATION_ALERT_THRESHOLD_HINT =
  '알림 기준 점수는 하나만 선택할 수 있어요. 여러 번 눌러도 마지막으로 고른 점수만 적용됩니다.';
