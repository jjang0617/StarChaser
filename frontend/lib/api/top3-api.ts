import type { WeeklyTop3ItemDto } from '../types/api';
import { authorizedGetJson } from './http';

export function fetchWeeklyTop3(weekStart?: string): Promise<WeeklyTop3ItemDto[]> {
  const q = new URLSearchParams();
  if (weekStart && weekStart.trim() !== '') q.set('weekStart', weekStart.trim());
  const suffix = q.size ? `?${q.toString()}` : '';
  return authorizedGetJson<WeeklyTop3ItemDto[]>(`/top3/weekly${suffix}`);
}
