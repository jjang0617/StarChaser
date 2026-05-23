import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';
import { WeeklyTop3AggregationService } from '../weekly-top3/weekly-top3-aggregation.service';
import { getKstYmd } from '../common/kst-date';
import { StarIndexCacheHydrationService } from '../cache-hydration/star-index-cache-hydration.service';

// ──────────────────────────────────────────────────────────────
// Cron 수집기 — 장성재(A) 담당
// 외부 API는 앱에서 직접 호출 금지 — 반드시 서버 수집 → 캐시 → 앱
// ──────────────────────────────────────────────────────────────

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
    @Inject(SPOT_REPOSITORY) private readonly spots: SpotRepository,
    private readonly weeklyTop3Aggregation: WeeklyTop3AggregationService,
    private readonly hydration: StarIndexCacheHydrationService,
  ) {}

  // ── 기상청 단기예보 — 매 1시간마다 수집 ─────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async collectWeatherData() {
    if (!this.config.get<string>('KMA_API_KEY')) {
      this.logger.warn('KMA_API_KEY가 없어 weather 수집을 건너뜁니다.');
      return;
    }

    try {
      const spots = await this.spots.findAll();
      if (!spots.length) {
        this.logger.warn('spots 데이터가 없어 weather 수집을 건너뜁니다.');
        return;
      }

      const grids = new Map<string, { nx: number; ny: number }>();
      for (const spot of spots) {
        const { nx, ny } = this.hydration.latLngToGrid(spot.lat, spot.lng);
        grids.set(`${nx}:${ny}`, { nx, ny });
      }

      for (const { nx, ny } of grids.values()) {
        const cacheKey = `weather:${nx}:${ny}`;
        try {
          await this.hydration.fetchAndStoreWeatherGrid(nx, ny);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`weather 수집 실패(기존 캐시 유지): ${cacheKey} - ${msg}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`weather 수집 실패(기존 캐시 유지): ${msg}`);
    }
  }

  // ── 에어코리아 PM2.5 — 매 1시간마다 수집 ─────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async collectDustData() {
    if (!this.config.get<string>('AIRKOREA_API_KEY')) {
      this.logger.warn('AIRKOREA_API_KEY가 없어 dust 수집을 건너뜁니다.');
      return;
    }

    try {
      await this.hydration.fetchAndStoreDustForAllSpots();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`dust 수집 실패(기존 캐시 유지): ${msg}`);
    }
  }

  // ── KASI 달 데이터 — 매일 자정(UTC) — 키는 KST 달력과 Star-Index 정합
  @Cron('0 0 * * *')
  async collectMoonData() {
    try {
      await this.hydration.fetchAndStoreMoonKstToday();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`moon 수집 실패(기존 캐시 유지): ${msg}`);
    }
  }

  // ── 주간 TOP3 일별 입력 — 매일 00:10 KST ──
  @Cron('10 0 * * *', { timeZone: 'Asia/Seoul' })
  async snapshotDailyStarIndexScoresJob() {
    this.logger.log('[Cron] 일별 Star-Index 스냅샷(명소 전체) 시작...');
    try {
      await this.weeklyTop3Aggregation.snapshotTodayStarIndexScores();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[Cron] 일별 스냅샷 실패: ${msg}`);
    }
  }

  // ── 주간 TOP3 — 매주 월요일 07:00 KST ────────────────────
  @Cron('0 7 * * 1', { timeZone: 'Asia/Seoul' })
  async calcWeeklyTop3() {
    this.logger.log('[Cron] 주간 TOP3 집계 시작...');
    try {
      await this.weeklyTop3Aggregation.aggregateWeekTop3FromDaily();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[Cron] 주간 TOP3 집계 실패: ${msg}`);
    }
  }

  async runCollectionOnce(): Promise<void> {
    this.logger.log(
      '[Cron] run-once 시작 — weather → dust → moon (개별 실패 시 기존 TTL 유지)',
    );
    await this.collectWeatherData();
    await this.collectDustData();
    await this.collectMoonData();
    this.logger.log('[Cron] run-once 루프 종료');
  }

  async getCacheStatus(lat = 37.5665, lng = 126.978): Promise<{
    weatherKey: string;
    dustKey: string;
    moonKey: string;
    weatherExists: boolean;
    dustExists: boolean;
    moonExists: boolean;
  }> {
    const { nx, ny } = this.hydration.latLngToGrid(lat, lng);
    const weatherKey = `weather:${nx}:${ny}`;
    const dustKey = await this.hydration.resolveDustCacheKey(lat, lng);
    const moonKey = `moon:${getKstYmd().replace(/-/g, '')}`;

    const [weather, dust, moon] = await Promise.all([
      this.cache.get(weatherKey),
      this.cache.get(dustKey),
      this.cache.get(moonKey),
    ]);

    return {
      weatherKey,
      dustKey,
      moonKey,
      weatherExists: weather !== undefined && weather !== null,
      dustExists: dust !== undefined && dust !== null,
      moonExists: moon !== undefined && moon !== null,
    };
  }
}
