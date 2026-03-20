// ──────────────────────────────────────────────────────────────
// Repository 패턴 인터페이스
// DB가 Supabase → RDS로 바뀌어도 서비스 코드는 불변
// ──────────────────────────────────────────────────────────────

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  bortleClass: number;
  elevationM: number;        // ⭐ GPS 고도 변수 소스 (Star-Index 6%)
  hasParking: boolean;
  hasToilet: boolean;
  locationRadiusM: number;
}

// SpotRepository 인터페이스 — 서비스는 이것만 바라봄
export interface SpotRepository {
  findById(id: string): Promise<Spot | null>;
  findNearby(lat: number, lng: number, radiusM: number): Promise<Spot[]>;
  findAll(): Promise<Spot[]>;
}

// ── 주입 토큰 (NestJS DI용) ──────────────────────────────────
export const SPOT_REPOSITORY = 'SPOT_REPOSITORY';
