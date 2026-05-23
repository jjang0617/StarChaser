import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  WeeklyTop3Entry,
  WeeklyTop3Repository,
} from '../common/interfaces/weekly-top3.repository';
import { WeeklyTop3Entity } from './weekly-top3.entity';

@Injectable()
export class TypeOrmWeeklyTop3Repository implements WeeklyTop3Repository {
  constructor(
    @InjectRepository(WeeklyTop3Entity)
    private readonly repo: Repository<WeeklyTop3Entity>,
  ) {}

  async findByWeekStart(weekStart: string): Promise<WeeklyTop3Entry[]> {
    const rows = await this.repo
      .createQueryBuilder('w')
      .where('w.weekStart = :weekStart', { weekStart })
      .orderBy('w.rank', 'ASC')
      .addOrderBy('w.spotId', 'ASC')
      .getMany();
    return rows.map((e) => this.toEntry(e));
  }

  async findLatestWeekStart(): Promise<string | null> {
    const [row] = await this.repo.find({
      select: { weekStart: true } as unknown as { weekStart: true },
      order: { weekStart: 'DESC' },
      take: 1,
    });
    if (!row?.weekStart) return null;
    return normalizeDateOnly(row.weekStart);
  }

  async replaceWeek(
    weekStart: string,
    rows: Array<{ rank: number; spotId: string; avgStarIndex: number }>,
  ): Promise<void> {
    await this.repo.manager.transaction(async (em) => {
      await em.delete(WeeklyTop3Entity, { weekStart });
      if (!rows.length) return;
      await em.insert(
        WeeklyTop3Entity,
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

  private toEntry(e: WeeklyTop3Entity): WeeklyTop3Entry {
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
