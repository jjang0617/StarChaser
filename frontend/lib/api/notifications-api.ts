import {
  authorizedGetJson,
  authorizedPostJson,
} from './http';
import type { NotificationHistoryResponseDto } from '../types/api';

const HISTORY_DEFAULT_LIMIT = 20;

export function fetchNotificationHistory(
  options: { limit?: number; before?: string } = {},
): Promise<NotificationHistoryResponseDto> {
  const limit = options.limit ?? HISTORY_DEFAULT_LIMIT;
  const q = new URLSearchParams({ limit: String(limit) });
  if (options.before?.trim()) {
    q.set('before', options.before.trim());
  }
  return authorizedGetJson<NotificationHistoryResponseDto>(
    `/notifications/history?${q.toString()}`,
  );
}

export function markAllNotificationsRead(): Promise<{ ok: true }> {
  return authorizedPostJson<{ ok: true }>('/notifications/history/read-all', {});
}

/** 위치한 곳 알림 스케줄용 — 마지막 GPS·지역명 서버 저장 */
export function reportObserverLocation(params: {
  lat: number;
  lng: number;
  placeLabel?: string;
}): Promise<{ ok: true }> {
  return authorizedPostJson<{ ok: true }>('/notifications/observer-location', params);
}
