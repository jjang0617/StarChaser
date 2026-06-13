import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { WeatherSnapshot } from '../common/interfaces/weather-snapshot';
import { normalizeWeatherSnapshotForStorage } from '../common/interfaces/weather-snapshot';
import { enrichWeatherSnapshotForDisplay } from '../common/weather-snapshot-display.util';
import type { StarIndexCachePayload } from './star-index.types';

@Injectable()
export class StarIndexSpotScoreCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  spotIndexCacheKey(spotId: string): string {
    return `star_index:${spotId}`;
  }

  async read(spotId: string): Promise<StarIndexCachePayload | null> {
    const raw = await this.cache.get(this.spotIndexCacheKey(spotId));
    if (raw == null || typeof raw === 'number') {
      return null;
    }
    const o = raw as Record<string, unknown>;
    const score = Number(o.score);
    const wsRaw = o.weatherSnapshot;
    if (!Number.isFinite(score) || !wsRaw || typeof wsRaw !== 'object') {
      return null;
    }
    try {
      const weatherSnapshot = enrichWeatherSnapshotForDisplay(
        normalizeWeatherSnapshotForStorage(wsRaw as WeatherSnapshot),
      );
      return {
        score,
        weatherSnapshot,
        cachedAt: typeof o.cachedAt === 'string' ? o.cachedAt : undefined,
      };
    } catch {
      return null;
    }
  }

  async write(spotId: string, payload: StarIndexCachePayload): Promise<void> {
    await this.cache.set(
      this.spotIndexCacheKey(spotId),
      { ...payload, cachedAt: new Date().toISOString() },
      3600 * 1000,
    );
  }
}
