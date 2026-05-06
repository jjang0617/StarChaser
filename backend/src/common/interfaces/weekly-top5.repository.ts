export interface WeeklyTop5Entry {
  id: string;
  weekStart: string;
  rank: number;
  spotId: string;
  avgStarIndex: number;
  createdAt: Date;
}

export interface WeeklyTop5Repository {
  findByWeekStart(weekStart: string): Promise<WeeklyTop5Entry[]>;
  findLatestWeekStart(): Promise<string | null>;
  replaceWeek(
    weekStart: string,
    rows: Array<{ rank: number; spotId: string; avgStarIndex: number }>,
  ): Promise<void>;
}

export const WEEKLY_TOP5_REPOSITORY = 'WEEKLY_TOP5_REPOSITORY';
