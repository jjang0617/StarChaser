import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { findSidoByLatLng } from '../cache-hydration/airkorea-sido-bbox.util';
import {
  dustStationCacheKey,
  hasStationCoords,
} from '../cache-hydration/airkorea-station.util';
import {
  parseForecastNumbers,
  type VilageFcstItem,
} from '../cache-hydration/kma-forecast.util';
import {
  normalizeDustCacheEntry,
  normalizeWeatherCacheEntry,
} from '../common/weather-snapshot-display.util';
import { moonStateAtObserver } from '../sky/moon-ephemeris.util';
import { StarIndexCacheHydrationService } from '../cache-hydration/star-index-cache-hydration.service';
import type { DustData, MoonData, WeatherData } from './star-index.types';

@Injectable()
export class StarIndexInputCacheReader {
  private readonly logger = new Logger(StarIndexInputCacheReader.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly cacheHydration: StarIndexCacheHydrationService,
  ) {}

  readWeatherCache(raw: unknown, atUtc?: Date): WeatherData | null {
    const n = normalizeWeatherCacheEntry(raw);
    if (!n || n.cloud === undefined) return null;
    const w = raw as Record<string, unknown>;
    const items = w.fcstItems;
    if (Array.isArray(items) && items.length > 0) {
      const nums = parseForecastNumbers(
        items as VilageFcstItem[],
        atUtc ?? new Date(),
      );
      return {
        skyCode: nums.skyCode,
        cloud: nums.cloud,
        humidity: nums.humidity,
        windSpeed: nums.windSpeed,
        visibility: nums.visibility,
        visibilityKnown: nums.visibilityKnown,
        temperature: nums.temperature,
        pop: nums.pop,
        pty: nums.pty,
      };
    }
    const skyRaw = Number(w.skyCode);
    return {
      skyCode: Number.isFinite(skyRaw) ? skyRaw : (n.skyCode ?? 1),
      cloud: n.cloud,
      humidity: Number(w.humidity) || 70,
      windSpeed: Number(w.windSpeed) || 2,
      visibility: Number(w.visibility) || 10,
      visibilityKnown: w.visibilityKnown === true,
      temperature: Number(w.temperature) || 12,
      pop: Number(w.pop) || 0,
      pty: Number(w.pty) || 0,
    };
  }

  readDustCache(raw: unknown): DustData | null {
    const n = normalizeDustCacheEntry(raw);
    if (n?.pm25 === undefined || !Number.isFinite(n.pm25)) return null;
    return {
      pm25: n.pm25,
      pm25Label: n.pm25Label,
      stationName: n.stationName,
    };
  }

  async readDustCacheForLocation(
    lat: number,
    lng: number,
    dustKey: string,
  ): Promise<DustData | null> {
    const direct = this.readDustCache(await this.cache.get(dustKey));
    if (direct) return direct;

    try {
      const catalog = await this.cacheHydration.getStationCatalogCached();
      const sidoName = findSidoByLatLng(lat, lng);
      const reps = catalog.filter(
        (e) => e.sidoName === sidoName && hasStationCoords(e),
      );
      for (const rep of reps) {
        const key = dustStationCacheKey(rep.stationName);
        if (key === dustKey) continue;
        const alt = this.readDustCache(await this.cache.get(key));
        if (alt) {
          return { ...alt, stationName: rep.stationName };
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.debug(`dust 시도 폴백 조회 생략: ${msg}`);
    }
    return null;
  }

  resolveMoonAt(
    lat: number,
    lng: number,
    cached: MoonData,
    atUtc?: Date,
  ): MoonData {
    const ephemeris = moonStateAtObserver(lat, lng, atUtc);
    return {
      phase: cached.phase > 0 ? cached.phase : ephemeris.phase,
      altitude: ephemeris.altitude,
      moonAltitudeKnown: true,
    };
  }
}
