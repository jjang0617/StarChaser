// ──────────────────────────────────────────────────────────────
// CacheService 인터페이스
// Phase 1: MemoryCacheService 구현
// Phase 2: RedisCacheService로 교체 — 서비스 코드 변경 없음
// ──────────────────────────────────────────────────────────────

import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// ── 인터페이스 — 변하지 않는 계약 ────────────────────────────
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

// ── Phase 1 구현체 — NestJS 메모리 캐시 ──────────────────────
@Injectable()
export class MemoryCacheService implements CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cm: Cache) {}

async get<T>(key: string): Promise<T | null> {
  const value = await this.cm.get<T>(key);
  return value ?? null;
}

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.cm.set(key, value, ttlSeconds * 1000);
  }

  async del(key: string): Promise<void> {
    await this.cm.del(key);
  }
}

// ── Phase 2: Redis 전환 시 아래 구현체로 교체 ─────────────────
// @Injectable()
// export class RedisCacheService implements CacheService {
//   constructor(@InjectRedis() private readonly redis: Redis) {}
//   async get<T>(key: string) { ... }
//   async set(key, value, ttlSeconds) { ... }
//   async del(key) { ... }
// }
