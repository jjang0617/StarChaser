import {
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
  type Spot,
} from '../common/interfaces/spot.repository';
import { latLngToGrid } from '../cache-hydration/kma-grid.util';
import { haversineKm } from '../cache-hydration/airkorea-station.util';
import { StarIndexCacheHydrationService } from '../cache-hydration/star-index-cache-hydration.service';
import { CorrectionsService } from '../corrections/corrections.service';
import {
  buildInputCacheKeys,
  type StarIndexInputCacheKeys,
} from './star-index-cache-keys.util';
import {
  STAR_INDEX_INPUT_CACHE_UNAVAILABLE_BATCH,
  throwStarIndexInputCacheUnavailable,
} from './star-index.errors';
import { StarIndexInputCacheReader } from './star-index-input-cache.reader';
import { StarIndexSpotScoreCacheService } from './star-index-spot-score-cache.service';
import {
  calcStarIndex as buildStarIndexScore,
  calcStarIndexWithSnapshot as buildStarIndexWithSnapshot,
  recalcScoreFromWeatherSnapshot,
} from './star-index-scoring.builder';
import {
  GPS_NEAREST_SPOT_RADIUS_M,
  type MoonData,
  type StarIndexCachePayload,
  type StarIndexFromCacheResult,
  type StarIndexInput,
} from './star-index.types';

export {
  GPS_NEAREST_SPOT_RADIUS_M,
  type StarIndexFromCacheResult,
  type StarIndexInput,
} from './star-index.types';

@Injectable()
export class StarIndexService {
  private readonly logger = new Logger(StarIndexService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(SPOT_REPOSITORY) private readonly spots: SpotRepository,
    private readonly correctionsService: CorrectionsService,
    private readonly cacheHydration: StarIndexCacheHydrationService,
    private readonly inputCache: StarIndexInputCacheReader,
    private readonly spotScoreCache: StarIndexSpotScoreCacheService,
  ) {}

  async calculateForSpotFromCache(
    spot: Spot,
    atUtc?: Date,
  ): Promise<StarIndexFromCacheResult> {
    const cacheKeys = await this.resolveInputCacheKeys(
      spot.lat,
      spot.lng,
      spot.dustStationName,
    );

    try {
      return await this.calculateSpotFresh(spot, cacheKeys, atUtc);
    } catch (e) {
      if (!(e instanceof ServiceUnavailableException)) {
        throw e;
      }
      const stale = await this.staleFallbackFromSpot(
        spot.id,
        spot.lat,
        spot.lng,
        cacheKeys,
        atUtc,
      );
      if (!stale) throw e;
      return stale;
    }
  }

  async calculateForLatLngFromCache(
    lat: number,
    lng: number,
    atUtc?: Date,
  ): Promise<
    StarIndexFromCacheResult & {
      nearestSpot: Spot | null;
      distanceKm: number | null;
    }
  > {
    const cacheKeys = await this.resolveInputCacheKeys(lat, lng);
    const { weatherKey, dustKey, moonKey } = cacheKeys;

    const [weather, dust, moonRaw, nearest] = await Promise.all([
      this.cache
        .get(weatherKey)
        .then((raw) => this.inputCache.readWeatherCache(raw, atUtc)),
      this.inputCache.readDustCacheForLocation(lat, lng, dustKey),
      this.cache.get<MoonData>(moonKey),
      this.spots.findNearest(lat, lng, GPS_NEAREST_SPOT_RADIUS_M),
    ]);

    const distanceKm = nearest
      ? haversineKm(lat, lng, nearest.lat, nearest.lng)
      : null;

    if (!weather || !dust || !moonRaw) {
      const staleSpotId = nearest?.id ?? null;
      if (staleSpotId) {
        const stale = await this.staleFallbackFromSpot(
          staleSpotId,
          lat,
          lng,
          cacheKeys,
          atUtc,
          { nearestSpot: nearest, distanceKm },
        );
        if (stale) {
          return {
            ...stale,
            nearestSpot: stale.nearestSpot ?? nearest,
            distanceKm: stale.distanceKm ?? distanceKm,
          };
        }
      }
      throwStarIndexInputCacheUnavailable();
    }

    const moon = this.inputCache.resolveMoonAt(lat, lng, moonRaw, atUtc);
    const bortleClass = nearest?.bortleClass ?? 5;
    const elevationM = nearest?.elevationM ?? 100;
    const correctionScore = nearest
      ? await this.correctionScoreForSpot(nearest.id)
      : 100;

    const { score, weatherSnapshot } = buildStarIndexWithSnapshot({
      weather,
      dust,
      moon,
      bortleClass,
      elevationM,
      lat,
      lng,
      atUtc,
      correctionScore,
    });

    return {
      score,
      weatherSnapshot,
      cacheKeys,
      nearestSpot: nearest,
      distanceKm,
    };
  }

  async calculateSpotScoresBatch(
    spots: Spot[],
  ): Promise<{ spotId: string; score: number }[]> {
    if (!spots.length) return [];

    await this.cacheHydration.ensureForStarIndexBatch(
      spots.map((s) => ({
        lat: s.lat,
        lng: s.lng,
        dustStationName: s.dustStationName,
      })),
    );

    const items: { spotId: string; score: number }[] = [];
    await Promise.all(
      spots.map(async (spot) => {
        try {
          const result = await this.calculateForSpotFromCache(spot);
          items.push({ spotId: spot.id, score: result.score });
        } catch (e) {
          this.logger.warn(
            `지도 배치 점수 생략 — spot: ${spot.id}, ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }),
    );
    return items;
  }

  async computeFreshPayloadFromCache(spot: Spot): Promise<StarIndexCachePayload> {
    const cacheKeys = await this.resolveInputCacheKeys(
      spot.lat,
      spot.lng,
      spot.dustStationName,
    );

    const weather = this.inputCache.readWeatherCache(
      await this.cache.get(cacheKeys.weatherKey),
    );
    const dust = this.inputCache.readDustCache(
      await this.cache.get(cacheKeys.dustKey),
    );
    const moonRaw = await this.cache.get<MoonData>(cacheKeys.moonKey);

    if (!weather || !dust || !moonRaw) {
      throwStarIndexInputCacheUnavailable(STAR_INDEX_INPUT_CACHE_UNAVAILABLE_BATCH);
    }

    const moon = this.inputCache.resolveMoonAt(spot.lat, spot.lng, moonRaw);
    const correctionScore = await this.correctionScoreForSpot(spot.id);

    const payload = buildStarIndexWithSnapshot({
      weather,
      dust,
      moon,
      bortleClass: spot.bortleClass,
      elevationM: spot.elevationM,
      lat: spot.lat,
      lng: spot.lng,
      correctionScore,
    });
    await this.spotScoreCache.write(spot.id, payload);
    return { ...payload, cachedAt: new Date().toISOString() };
  }

  async computeFreshScoreFromCache(spot: Spot): Promise<number> {
    return (await this.computeFreshPayloadFromCache(spot)).score;
  }

  async getStarIndexBySpotId(
    spotId: string,
    input: StarIndexInput,
  ): Promise<StarIndexCachePayload> {
    const computed = buildStarIndexWithSnapshot(input);
    const payload: StarIndexCachePayload = {
      ...computed,
      cachedAt: new Date().toISOString(),
    };
    await this.cache.set(
      this.spotScoreCache.spotIndexCacheKey(spotId),
      payload,
      7 * 24 * 3600 * 1000, // 7 days fallback cache TTL
    );
    this.logger.log(`Star-Index 계산 완료 — spot: ${spotId}, score: ${payload.score}`);
    return payload;
  }

  calcStarIndex(input: StarIndexInput): number {
    return buildStarIndexScore(input);
  }

  calcStarIndexWithSnapshot(input: StarIndexInput): StarIndexCachePayload {
    return buildStarIndexWithSnapshot(input);
  }

  private async correctionScoreForSpots(
    spotIds: string[],
  ): Promise<Map<string, number>> {
    return this.correctionsService.getAggregatedCorrectionScoresForSpots(spotIds);
  }

  private async correctionScoreForSpot(spotId: string): Promise<number> {
    const map = await this.correctionScoreForSpots([spotId]);
    return map.get(spotId) ?? 100;
  }

  private async resolveInputCacheKeys(
    lat: number,
    lng: number,
    dustStationName?: string | null,
  ): Promise<StarIndexInputCacheKeys> {
    await this.cacheHydration.ensureForStarIndexRequest(
      lat,
      lng,
      dustStationName,
    );
    const dustKey = await this.cacheHydration.resolveDustCacheKey(
      lat,
      lng,
      dustStationName,
    );
    return buildInputCacheKeys(lat, lng, dustKey);
  }

  private async staleFallbackFromSpot(
    spotId: string,
    lat: number,
    lng: number,
    cacheKeys: StarIndexInputCacheKeys,
    atUtc?: Date,
    gpsMeta?: { nearestSpot: Spot | null; distanceKm: number | null },
  ): Promise<
    | (StarIndexFromCacheResult & {
        nearestSpot?: Spot | null;
        distanceKm?: number | null;
      })
    | null
  > {
    const stale = await this.spotScoreCache.read(spotId);
    if (!stale) return null;
    this.logger.warn(
      `Star-Index stale fallback — spot: ${spotId}, cachedAt: ${stale.cachedAt ?? 'unknown'}`,
    );
    const base: StarIndexFromCacheResult = {
      score: recalcScoreFromWeatherSnapshot(
        stale.weatherSnapshot,
        lat,
        lng,
        atUtc,
      ),
      weatherSnapshot: stale.weatherSnapshot,
      cacheKeys,
      isStale: true,
      cachedAt: stale.cachedAt,
    };
    if (gpsMeta) {
      return { ...base, ...gpsMeta };
    }
    return base;
  }

  private async calculateSpotFresh(
    spot: Spot,
    cacheKeys: { weatherKey: string; dustKey: string; moonKey: string },
    atUtc?: Date,
  ): Promise<StarIndexFromCacheResult> {
    const weather = this.inputCache.readWeatherCache(
      await this.cache.get(cacheKeys.weatherKey),
      atUtc,
    );
    const dust = await this.inputCache.readDustCacheForLocation(
      spot.lat,
      spot.lng,
      cacheKeys.dustKey,
    );
    const moonRaw = await this.cache.get<MoonData>(cacheKeys.moonKey);

    if (!weather || !dust || !moonRaw) {
      throwStarIndexInputCacheUnavailable();
    }

    const moon = this.inputCache.resolveMoonAt(spot.lat, spot.lng, moonRaw, atUtc);
    const correctionScore = await this.correctionScoreForSpot(spot.id);

    const { score, weatherSnapshot } = await this.getStarIndexBySpotId(spot.id, {
      weather,
      dust,
      moon,
      bortleClass: spot.bortleClass,
      elevationM: spot.elevationM,
      lat: spot.lat,
      lng: spot.lng,
      atUtc,
      correctionScore,
    });

    return { score, weatherSnapshot, cacheKeys };
  }

  async testApiConnections(lat = 37.5665, lng = 126.9780): Promise<void> {
    const KMA_KEY = process.env.KMA_API_KEY;
    const AIRKOREA_KEY = process.env.AIRKOREA_API_KEY;

    const { nx, ny } = latLngToGrid(lat, lng);
    this.logger.log(`격자 변환 결과 — lat: ${lat}, lng: ${lng} → nx: ${nx}, ny: ${ny}`);

    const now = new Date();
    const baseDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    const baseTime = '0500';

    const kmaUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${KMA_KEY}&numOfRows=10&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;

    const airUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${AIRKOREA_KEY}&returnType=json&numOfRows=5&pageNo=1&sidoName=서울&ver=1.0`;

    try {
      const [kmaRes, airRes] = await Promise.all([fetch(kmaUrl), fetch(airUrl)]);

      const kmaData = await kmaRes.json();
      const airData = await airRes.json();

      this.logger.log(`기상청 API 응답: ${JSON.stringify(kmaData).slice(0, 200)}`);
      this.logger.log(`에어코리아 API 응답: ${JSON.stringify(airData).slice(0, 200)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`API 호출 실패: ${msg}`);
    }
  }
}
