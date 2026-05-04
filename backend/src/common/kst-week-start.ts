import { BadRequestException } from '@nestjs/common';
import {
  lastCompletedWeekMondayKst,
  parseKstYmdInput,
  thisWeekMondayKst,
} from './kst-date';

/** `GET /top5/weekly?weekStart=` — DB `week_start`와 맞는 YYYY-MM-DD. */
export function requireQueryYmd(raw: string): string {
  const r = parseKstYmdInput(raw);
  if (!r.ok) {
    throw new BadRequestException(
      r.error === 'format'
        ? 'weekStart는 YYYY-MM-DD 형식이어야 합니다.'
        : 'weekStart가 유효한 날짜가 아닙니다.',
    );
  }
  return r.ymd;
}

/** `job=weeklyTop5` — 비우면 직전 완료 주 월요일, 있으면 해당 날짜가 속한 KST 주의 월요일. */
export function resolveAggregationWeekMonday(weekStart?: string): string {
  if (weekStart == null || weekStart.trim() === '') {
    return lastCompletedWeekMondayKst();
  }
  return thisWeekMondayKst(requireQueryYmd(weekStart));
}
