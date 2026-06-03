import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WeeklyTop3AggregationService } from '../weekly-top3/weekly-top3-aggregation.service';
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
    private readonly weeklyTop3Aggregation: WeeklyTop3AggregationService,
    private readonly hydration: StarIndexCacheHydrationService,
    private readonly cacheRefresh: StarIndexCacheRefreshService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async collectWeatherData() {
    await this.cacheRefresh.refreshWeatherFromSpots();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async collectDustData() {
    await this.cacheRefresh.refreshDust();
  }

  @Cron('0 0 * * *')
  async collectMoonData() {
    await this.cacheRefresh.refreshMoon();
  }

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
    await this.cacheRefresh.refreshAll();
  }

  getCacheStatus(lat = 37.5665, lng = 126.978) {
    return this.hydration.getInputCacheStatus(lat, lng);
  }
}
