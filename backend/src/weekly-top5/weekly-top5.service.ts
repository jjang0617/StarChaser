import {
  BadRequestException,
  Injectable,
  Inject,
} from '@nestjs/common';
import {
  WEEKLY_TOP5_REPOSITORY,
  type WeeklyTop5Entry,
  type WeeklyTop5Repository,
} from '../common/interfaces/weekly-top5.repository';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';
import { WeeklyTop5ItemDto } from './dto/weekly-top5-item.dto';

const WEEK_START_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class WeeklyTop5Service {
  constructor(
    @Inject(WEEKLY_TOP5_REPOSITORY)
    private readonly weeklyTop5Repo: WeeklyTop5Repository,
    @Inject(SPOT_REPOSITORY)
    private readonly spots: SpotRepository,
  ) {}

  /**
   * @param weekStart YYYY-MM-DD 생략 시 DB의 MAX(week_start)
   */
  async getWeekly(weekStart?: string): Promise<WeeklyTop5ItemDto[]> {
    const resolved =
      weekStart != null && weekStart.trim() !== ''
        ? parseWeekStartQuery(weekStart.trim())
        : await this.weeklyTop5Repo.findLatestWeekStart();

    if (resolved == null) {
      return [];
    }

    const rows = await this.weeklyTop5Repo.findByWeekStart(resolved);
    if (rows.length === 0) {
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
    };
  }
}

function parseWeekStartQuery(raw: string): string {
  if (!WEEK_START_RE.test(raw)) {
    throw new BadRequestException('weekStart는 YYYY-MM-DD 형식이어야 합니다.');
  }
  const d = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('weekStart가 유효한 날짜가 아닙니다.');
  }
  return raw.slice(0, 10);
}
