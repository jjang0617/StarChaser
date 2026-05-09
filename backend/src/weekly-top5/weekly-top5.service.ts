import { Injectable, Inject } from '@nestjs/common';
import {
  WEEKLY_TOP5_REPOSITORY,
  type WeeklyTop5Entry,
  type WeeklyTop5Repository,
} from '../common/interfaces/weekly-top5.repository';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';
import { requireQueryYmd } from '../common/kst-week-start';
import { WeeklyTop5ItemDto } from './dto/weekly-top5-item.dto';

@Injectable()
export class WeeklyTop5Service {
  constructor(
    @Inject(WEEKLY_TOP5_REPOSITORY)
    private readonly weeklyTop5Repo: WeeklyTop5Repository,
    @Inject(SPOT_REPOSITORY)
    private readonly spots: SpotRepository,
  ) {}

  /** `weekStart` 생략 시 `MAX(week_start)` 주차. */
  async getWeekly(weekStart?: string): Promise<WeeklyTop5ItemDto[]> {
    const resolved =
      weekStart != null && weekStart.trim() !== ''
        ? requireQueryYmd(weekStart)
        : await this.weeklyTop5Repo.findLatestWeekStart();

    if (resolved == null) {
      return [];
    }

    const rows = await this.weeklyTop5Repo.findByWeekStart(resolved);
    if (!rows.length) {
      return [];
    }

    return Promise.all(rows.map((r) => this.toDto(r)));
  }

  private async toDto(row: WeeklyTop5Entry): Promise<WeeklyTop5ItemDto> {
    const spot = await this.spots.findById(row.spotId);
    return {
      id: row.id,
      weekStart: row.weekStart,
      rank: row.rank,
      spotId: row.spotId,
      spotName: spot?.name ?? '(명소 없음)',
      avgStarIndex: row.avgStarIndex,
      avgStarIndexText: String(row.avgStarIndex),
    };
  }
}
