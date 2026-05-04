// ──────────────────────────────────────────────────────────────
// Repository 패턴 — weekly_top5 조회·저장은 서비스가 이 인터페이스만 사용
// ──────────────────────────────────────────────────────────────

/** 도메인 단위 행 (spots 조인은 호출 측 또는 후속 메서드에서) */
export interface WeeklyTop5Entry {
  id: string;
  /** YYYY-MM-DD */
  weekStart: string;
  rank: number;
  spotId: string;
  avgStarIndex: number;
  createdAt: Date;
}

export interface WeeklyTop5Repository {
  /** 해당 주 차 순위표를 rank 오름차순으로 조회 (동순위 시 spot_id 안정 정렬) */
  findByWeekStart(weekStart: string): Promise<WeeklyTop5Entry[]>;

  /** 집계된 행이 있을 때 가장 최근 `week_start`(DATE). 없으면 null */
  findLatestWeekStart(): Promise<string | null>;
}

export const WEEKLY_TOP5_REPOSITORY = 'WEEKLY_TOP5_REPOSITORY';
