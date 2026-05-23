export interface WeeklyTop3Entry {
  id: string;
  weekStart: string;
  rank: number;
  spotId: string;
  avgStarIndex: number;
  createdAt: Date;
}

export interface WeeklyTop3Repository {
  findByWeekStart(weekStart: string): Promise<WeeklyTop3Entry[]>;
  findLatestWeekStart(): Promise<string | null>;
  replaceWeek(
    weekStart: string,
    rows: Array<{ rank: number; spotId: string; avgStarIndex: number }>,
  ): Promise<void>;
}

export const WEEKLY_TOP3_REPOSITORY = 'WEEKLY_TOP3_REPOSITORY';
