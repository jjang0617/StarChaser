/** Star-Index stale(직전 캐시) 표시 문구 */

export function formatStarIndexStaleHint(cachedAt?: string): string {
  if (!cachedAt?.trim()) {
    return '참고 · 직전 계산값 (실시간 기상 캐시 없음)';
  }
  const t = Date.parse(cachedAt);
  if (!Number.isFinite(t)) {
    return '참고 · 직전 계산값';
  }
  const mins = Math.max(1, Math.round((Date.now() - t) / 60_000));
  if (mins < 60) {
    return `참고 · ${mins}분 전 계산값`;
  }
  const hours = Math.round(mins / 60);
  if (hours < 24) {
    return `참고 · 약 ${hours}시간 전 계산값`;
  }
  return '참고 · 직전 계산값';
}

import { sanitizeApiErrorMessage } from './sanitize-api-error';

export function starIndexLoadErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'status' in e && 'message' in e) {
    const status = (e as { status: number }).status;
    const message = String((e as { message: string }).message);
    return sanitizeApiErrorMessage(status, message);
  }
  return 'Star-Index를 불러오지 못했습니다.';
}
