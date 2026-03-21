// ──────────────────────────────────────────────────────────────
// ObservationRepository 인터페이스
// ──────────────────────────────────────────────────────────────

export interface Observation {
  id: string;
  userId: string;
  spotId: string | null;
  starIndexVal: number;
  weatherSnapshot: Record<string, unknown>; // 9개 변수 스냅샷
  result: 'success' | 'partial' | 'fail';
  observedAt: Date;
}

// ObservationRepository 인터페이스 — 서비스는 이것만 바라봄
export interface ObservationRepository {
  findById(id: string): Promise<Observation | null>;
  findByUserId(userId: string): Promise<Observation[]>;
  save(observation: Omit<Observation, 'id'>): Promise<Observation>;
  deleteById(id: string): Promise<void>;
}

// ── 주입 토큰 (NestJS DI용) ──────────────────────────────────
export const OBSERVATION_REPOSITORY = 'OBSERVATION_REPOSITORY';