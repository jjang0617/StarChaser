import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StarIndexCacheHydrationService } from '../cache-hydration/star-index-cache-hydration.service';
import { StarIndexCacheRefreshService } from '../cache-hydration/star-index-cache-refresh.service';

// ──────────────────────────────────────────────────────────────
// Cron 수집기 — 장성재(A) 담당
// 외부 API는 앱에서 직접 호출 금지 — 반드시 서버 수집 → 캐시 → 앱
// ──────────────────────────────────────────────────────────────

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly hydration: StarIndexCacheHydrationService,
    private readonly cacheRefresh: StarIndexCacheRefreshService,
  ) {}

  @Cron('0 */3 * * *')
  async collectWeatherData() {
    await this.cacheRefresh.refreshWeatherFromSpots();
  }

  @Cron('0 */3 * * *')
  async collectDustData() {
    await this.cacheRefresh.refreshDust();
  }

  @Cron('0 0 * * *')
  async collectMoonData() {
    await this.cacheRefresh.refreshMoon();
  }

  async runCollectionOnce(): Promise<void> {
    await this.cacheRefresh.refreshAll();
  }

  getCacheStatus(lat = 37.5665, lng = 126.978) {
    return this.hydration.getInputCacheStatus(lat, lng);
  }
}
