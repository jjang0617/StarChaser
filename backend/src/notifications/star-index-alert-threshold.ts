import type { StarIndexAlertThreshold } from '../common/interfaces/notification.repository';

export const STAR_INDEX_ALERT_THRESHOLDS: readonly StarIndexAlertThreshold[] = [
  80, 85, 90, 95,
] as const;

export const DEFAULT_STAR_INDEX_ALERT_THRESHOLD: StarIndexAlertThreshold = 90;

export function normalizeStarIndexAlertThreshold(
  value: unknown,
): StarIndexAlertThreshold {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (STAR_INDEX_ALERT_THRESHOLDS.includes(n as StarIndexAlertThreshold)) {
    return n as StarIndexAlertThreshold;
  }
  return DEFAULT_STAR_INDEX_ALERT_THRESHOLD;
}
