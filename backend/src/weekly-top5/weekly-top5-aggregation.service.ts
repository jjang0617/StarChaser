import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { StarIndexService } from '../star-index/star-index.service';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';
import {
  WEEKLY_TOP5_REPOSITORY,
  type WeeklyTop5Repository,
} from '../common/interfaces/weekly-top5.repository';
import { getKstYmd, weekEndSundayKst } from '../common/kst-date';
import { resolveAggregationWeekMonday } from '../common/kst-week-start';
import { SpotStarIndexDailyEntity } from './spot-star-index-daily.entity';

const WEEKLY_TOP5_CACHE_MS = 86_400_000;

@Injectable()
export class WeeklyTop5AggregationService {
  private readonly logger = new Logger(WeeklyTop5AggregationService.name);

  constructor(
    @Inject(SPOT_REPOSITORY) private readonly spots: SpotRepository,
    private readonly starIndex: StarIndexService,
    @InjectRepository(SpotStarIndexDailyEntity)
    private readonly dailyRepo: Repository<SpotStarIndexDailyEntity>,
    @Inject(WEEKLY_TOP5_REPOSITORY)
    private readonly weeklyTop5: WeeklyTop5Repository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** KST 오늘, 캐시 기준 점수 → `spot_star_index_daily` upsert. */
  async snapshotTodayStarIndexScores(): Promise<{
    day: string;
    ok: number;
    failed: number;
    ms: number;
  }> {
    const t0 = Date.now();
    const day = getKstYmd();
    const all = await this.spots.findAll();
    let ok = 0;
    let failed = 0;

    for (const spot of all) {
      try {
        const score = await this.starIndex.computeFreshScoreFromCache(spot);
        await this.dailyRepo.upsert(
          { spotId: spot.id, day, score },
          ['spotId', 'day'],
        );
        ok++;
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[TOP5 daily] spot ${spot.id} 스킵: ${msg}`);
      }
    }

    const ms = Date.now() - t0;
    this.logger.log(
      `[TOP5 daily] 완료 day=${day} ok=${ok} failed=${failed} 소요=${ms}ms`,
    );
    return { day, ok, failed, ms };
  }

  /**
   * `spot_star_index_daily` 주간 평균 TOP5 → `weekly_top5` + 캐시.
   * `weekStart` 없음: 직전 완료 주(월~일). 있음: 그 날짜가 속한 KST 주.
   */
  async aggregateWeekTop5FromDaily(weekStart?: string): Promise<{
    weekStart: string;
    weekEnd: string;
    inserted: number;
    ms: number;
  }> {
    const t0 = Date.now();
    const mon = resolveAggregationWeekMonday(weekStart);
    const weekEnd = weekEndSundayKst(mon);

    const raw = await this.dailyRepo
      .createQueryBuilder('d')
      .select('d.spot_id', 'spot_id')
      .addSelect('ROUND(AVG(d.score)::numeric, 2)', 'avg_score')
      .where('d.day >= :start AND d.day <= :end', { start: mon, end: weekEnd })
      .groupBy('d.spot_id')
      .orderBy('AVG(d.score)', 'DESC')
      .addOrderBy('d.spot_id', 'ASC')
      .limit(5)
      .getRawMany<{ spot_id: string; avg_score: string }>();

    const rows = raw.map((r, i) => ({
      rank: i + 1,
      spotId: r.spot_id,
      avgStarIndex: Number(r.avg_score),
    }));

    await this.weeklyTop5.replaceWeek(mon, rows);

    await this.cache.set(
      `top5:weekly:${mon}`,
      rows.map((r) => ({
        weekStart: mon,
        rank: r.rank,
        spotId: r.spotId,
        avgStarIndex: r.avgStarIndex,
      })),
      WEEKLY_TOP5_CACHE_MS,
    );

    const ms = Date.now() - t0;
    this.logger.log(
      `[TOP5 weekly] 완료 week_start=${mon}~${weekEnd} rows=${rows.length} 소요=${ms}ms`,
    );
    return { weekStart: mon, weekEnd, inserted: rows.length, ms };
  }
}
