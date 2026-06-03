import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';
import { StarIndexCacheHydrationService } from './star-index-cache-hydration.service';

/**
 * Star-Index 입력 캐시(weather / dust / moon) 갱신 — Cron·기동 워밍 공용
 */
@Injectable()
export class StarIndexCacheRefreshService {
  private readonly logger = new Logger(StarIndexCacheRefreshService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(SPOT_REPOSITORY) private readonly spots: SpotRepository,
    private readonly hydration: StarIndexCacheHydrationService,
  ) {}

  async refreshWeatherFromSpots(): Promise<void> {
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
          this.logger.warn(
            `weather 수집 실패(기존 캐시 유지): ${cacheKey} - ${msg}`,
          );
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`weather 수집 실패(기존 캐시 유지): ${msg}`);
    }
  }

  async refreshDust(): Promise<void> {
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

  async refreshMoon(): Promise<void> {
    try {
      await this.hydration.fetchAndStoreMoonKstToday();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`moon 수집 실패(기존 캐시 유지): ${msg}`);
    }
  }

  /** Cron run-once · 수동 트리거와 동일 순서 */
  async refreshAll(): Promise<void> {
    this.logger.log(
      '[CacheRefresh] 전체 갱신 시작 — weather → dust → moon (개별 실패 시 기존 TTL 유지)',
    );
    await this.refreshWeatherFromSpots();
    await this.refreshDust();
    await this.refreshMoon();
    this.logger.log('[CacheRefresh] 전체 갱신 종료');
  }

  /**
   * 서버 기동 직후 백그라운드 워밍 — 첫 MAIN 요청 전 캐시 채움
   * API 키가 없으면 moon·카탈로그만 준비
   */
  async warmOnStartup(): Promise<void> {
    this.logger.log('[CacheWarm] 기동 워밍 시작');
    try {
      await this.hydration.ensureStationCatalog();
      await this.refreshMoon();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[CacheWarm] moon·카탈로그 준비 실패: ${msg}`);
    }

    const hasKma = Boolean(this.config.get<string>('KMA_API_KEY'));
    const hasAir = Boolean(this.config.get<string>('AIRKOREA_API_KEY'));
    if (hasKma || hasAir) {
      await this.refreshAll();
    } else {
      this.logger.warn(
        '[CacheWarm] KMA·AIRKOREA 키 없음 — weather/dust 전체 갱신 생략',
      );
    }
    this.logger.log('[CacheWarm] 기동 워밍 종료');
  }
}
