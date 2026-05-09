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
    const rows = await this.repo
      .createQueryBuilder('w')
      // QueryBuilder에서는 엔티티 프로퍼티명을 사용해야 안정적으로 컬럼 매핑된다.
      .where('w.weekStart = :weekStart', { weekStart })
      .orderBy('w.rank', 'ASC')
      .addOrderBy('w.spotId', 'ASC')
      .getMany();
    return rows.map((e) => this.toEntry(e));
  }

  async findLatestWeekStart(): Promise<string | null> {
    // `MAX()` 대신 최신 row를 정렬로 조회 (date 타입 + driver 매핑 이슈 회피)
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
