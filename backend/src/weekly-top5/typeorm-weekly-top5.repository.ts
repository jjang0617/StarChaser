import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  WeeklyTop5Entry,
  WeeklyTop5Repository,
} from '../common/interfaces/weekly-top5.repository';
import { WeeklyTop5Entity } from './weekly-top5.entity';

@Injectable()
export class TypeOrmWeeklyTop5Repository implements WeeklyTop5Repository {
  constructor(
    @InjectRepository(WeeklyTop5Entity)
    private readonly repo: Repository<WeeklyTop5Entity>,
  ) {}

  async findByWeekStart(weekStart: string): Promise<WeeklyTop5Entry[]> {
    const rows = await this.repo.find({
      where: { weekStart },
      order: { rank: 'ASC', spotId: 'ASC' },
    });
    return rows.map((e) => this.toEntry(e));
  }

  async findLatestWeekStart(): Promise<string | null> {
    const row = await this.repo
      .createQueryBuilder('w')
      .select('MAX(w.week_start)', 'max')
      .getRawOne<{ max: string | Date | null }>();
    if (row?.max == null) return null;
    return normalizeDateOnly(row.max);
  }

  async replaceWeek(
    weekStart: string,
    rows: Array<{ rank: number; spotId: string; avgStarIndex: number }>,
  ): Promise<void> {
    await this.repo.manager.transaction(async (em) => {
      await em.delete(WeeklyTop5Entity, { weekStart });
      if (!rows.length) return;
      await em.insert(
        WeeklyTop5Entity,
        rows.map((r) => ({
          id: randomUUID(),
          weekStart,
          rank: r.rank,
          spotId: r.spotId,
          avgStarIndex: r.avgStarIndex.toFixed(2),
        })),
      );
    });
  }

  private toEntry(e: WeeklyTop5Entity): WeeklyTop5Entry {
    return {
      id: e.id,
      weekStart: normalizeDateOnly(e.weekStart),
      rank: e.rank,
      spotId: e.spotId,
      avgStarIndex: Number(e.avgStarIndex),
      createdAt: e.createdAt,
    };
  }
}

function normalizeDateOnly(v: string | Date): string {
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}
