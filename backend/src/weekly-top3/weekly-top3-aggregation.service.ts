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
  WEEKLY_TOP3_REPOSITORY,
  type WeeklyTop3Repository,
} from '../common/interfaces/weekly-top3.repository';
import { getKstYmd, weekEndSundayKst } from '../common/kst-date';
import { resolveAggregationWeekMonday } from '../common/kst-week-start';
import { SpotStarIndexDailyEntity } from './spot-star-index-daily.entity';

const WEEKLY_TOP3_CACHE_MS = 86_400_000;
const WEEKLY_TOP3_RANK_LIMIT = 3;

@Injectable()
export class WeeklyTop3AggregationService {
  private readonly logger = new Logger(WeeklyTop3AggregationService.name);

  constructor(
    @Inject(SPOT_REPOSITORY) private readonly spots: SpotRepository,
    private readonly starIndex: StarIndexService,
    @InjectRepository(SpotStarIndexDailyEntity)
    private readonly dailyRepo: Repository<SpotStarIndexDailyEntity>,
    @Inject(WEEKLY_TOP3_REPOSITORY)
    private readonly weeklyTop3: WeeklyTop3Repository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

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
        await this.cache.set(
          `star_index:${spot.id}`,
          { score, cachedAt: new Date().toISOString() },
          3600 * 1000,
        );
        ok++;
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[TOP3 daily] spot ${spot.id} 스킵: ${msg}`);
      }
    }

    const ms = Date.now() - t0;
    this.logger.log(
      `[TOP3 daily] 완료 day=${day} ok=${ok} failed=${failed} 소요=${ms}ms`,
    );
    return { day, ok, failed, ms };
  }

  async aggregateWeekTop3FromDaily(weekStart?: string): Promise<{
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
      .limit(WEEKLY_TOP3_RANK_LIMIT)
      .getRawMany<{ spot_id: string; avg_score: string }>();

    const rows = raw.map((r, i) => ({
      rank: i + 1,
      spotId: r.spot_id,
      avgStarIndex: Number(r.avg_score),
    }));

    await this.weeklyTop3.replaceWeek(mon, rows);

    await this.cache.set(
      `top3:weekly:${mon}`,
      rows.map((r) => ({
        weekStart: mon,
        rank: r.rank,
        spotId: r.spotId,
        avgStarIndex: r.avgStarIndex,
      })),
      WEEKLY_TOP3_CACHE_MS,
    );

    const ms = Date.now() - t0;
    this.logger.log(
      `[TOP3 weekly] 완료 week_start=${mon}~${weekEnd} rows=${rows.length} 소요=${ms}ms`,
    );
    return { weekStart: mon, weekEnd, inserted: rows.length, ms };
  }
}
