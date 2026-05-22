import { Injectable, Inject } from '@nestjs/common';
import {
  WEEKLY_TOP3_REPOSITORY,
  type WeeklyTop3Entry,
  type WeeklyTop3Repository,
} from '../common/interfaces/weekly-top3.repository';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';
import { requireQueryYmd } from '../common/kst-week-start';
import { WeeklyTop3ItemDto } from './dto/weekly-top3-item.dto';

@Injectable()
export class WeeklyTop3Service {
  constructor(
    @Inject(WEEKLY_TOP3_REPOSITORY)
    private readonly weeklyTop3Repo: WeeklyTop3Repository,
    @Inject(SPOT_REPOSITORY)
    private readonly spots: SpotRepository,
  ) {}

  async getWeekly(weekStart?: string): Promise<WeeklyTop3ItemDto[]> {
    const resolved =
      weekStart != null && weekStart.trim() !== ''
        ? requireQueryYmd(weekStart)
        : await this.weeklyTop3Repo.findLatestWeekStart();

    if (resolved == null) {
      return [];
    }

    const rows = await this.weeklyTop3Repo.findByWeekStart(resolved);
    if (!rows.length) {
      return [];
    }

    return Promise.all(rows.map((r) => this.toDto(r)));
  }

  private async toDto(row: WeeklyTop3Entry): Promise<WeeklyTop3ItemDto> {
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
