/** 서울 달력 기준 유틸 — Cron·집계 주차·moon 캐시 키에 사용 */

export function getKstYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** 해당 KST 날짜의 KST 자정을 나타내는 UTC 시각(ms) — 날짜 가산에 사용 */
export function kstYmdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d, -9, 0, 0);
}

export function addDaysKst(ymd: string, n: number): string {
  const t = kstYmdToUtcMs(ymd) + n * 86400000;
  return getKstYmd(new Date(t));
}

/** 0=월 … 6=일 (KST) */
export function kstWeekdayMon0(ymd: string): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(new Date(kstYmdToUtcMs(ymd) + 43200000));
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[wd] ?? 0;
}

/** KST 기준 해당 날짜가 속한 주의 월요일(YYYY-MM-DD) */
export function thisWeekMondayKst(ymd: string): string {
  return addDaysKst(ymd, -kstWeekdayMon0(ymd));
}

/**
 * 직전에 끝난 월~일 주간의 week_start(월요일).
 * 월요일 07:00 KST에 돌리면 방금 끝난 주(월~일)의 월요일.
 */
export function lastCompletedWeekMondayKst(d = new Date()): string {
  const today = getKstYmd(d);
  const thisMon = thisWeekMondayKst(today);
  return addDaysKst(thisMon, -7);
}

export function weekEndSundayKst(weekMonday: string): string {
  return addDaysKst(weekMonday, 6);
}

export type ParseKstYmdResult =
  | { ok: true; ymd: string }
  | { ok: false; error: 'format' | 'date' };

/** `weekStart` 쿼리 등 — trim 후 YYYY-MM-DD 검증만 (요일 정규화 없음). */
export function parseKstYmdInput(raw: string): ParseKstYmdResult {
  const ymd = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { ok: false, error: 'format' };
  }
  if (Number.isNaN(new Date(`${ymd}T12:00:00Z`).getTime())) {
    return { ok: false, error: 'date' };
  }
  return { ok: true, ymd };
}
