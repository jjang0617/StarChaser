import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';
import { StarIndexCorrectionSubmissionEntity } from './star-index-correction-submission.entity';
import type { CreateCorrectionSubmissionDto } from './dto/create-correction-submission.dto';

const AGGREGATION_WINDOW = 50;

@Injectable()
export class CorrectionsService {
  private readonly logger = new Logger(CorrectionsService.name);

  constructor(
    @InjectRepository(StarIndexCorrectionSubmissionEntity)
    private readonly repo: Repository<StarIndexCorrectionSubmissionEntity>,
    @Inject(SPOT_REPOSITORY)
    private readonly spots: SpotRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * 최근 제보 perceived_quality 평균을 correction_score(0~100)로 사용.
   * 제보가 없으면 100(중립, 기존 가중치와 동일 효과).
   */
  async getAggregatedCorrectionScoreForSpot(spotId: string): Promise<number> {
    const map = await this.getAggregatedCorrectionScoresForSpots([spotId]);
    return map.get(spotId) ?? 100;
  }

  /** 지도 클러스터 배치 — 명소 N곳 correction_score 1회 조회 */
  async getAggregatedCorrectionScoresForSpots(
    spotIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const unique = [...new Set(spotIds.filter(Boolean))];
    for (const id of unique) {
      out.set(id, 100);
    }
    if (!unique.length) {
      return out;
    }

    const rows = (await this.repo.query(
      `
      SELECT spot_id, ROUND(AVG(perceived_quality))::int AS score
      FROM (
        SELECT
          spot_id,
          perceived_quality,
          ROW_NUMBER() OVER (PARTITION BY spot_id ORDER BY created_at DESC) AS rn
        FROM star_index_correction_submissions
        WHERE spot_id = ANY($1::uuid[])
      ) ranked
      WHERE rn <= $2
      GROUP BY spot_id
      `,
      [unique, AGGREGATION_WINDOW],
    )) as { spot_id: string; score: number }[];

    for (const row of rows) {
      const score = Number(row.score);
      if (Number.isFinite(score)) {
        out.set(String(row.spot_id), Math.min(100, Math.max(0, score)));
      }
    }
    return out;
  }

  async create(userId: string, dto: CreateCorrectionSubmissionDto) {
    const spot = await this.spots.findById(dto.spotId);
    if (!spot) {
      throw new NotFoundException('해당 spotId의 명소가 없습니다.');
    }

    const row = this.repo.create({
      spotId: dto.spotId,
      userId,
      perceivedQuality: dto.perceivedQuality,
    });
    const saved = await this.repo.save(row);

    const starKey = `star_index:${dto.spotId}`;
    await this.cache.del(starKey);
    this.logger.log(
      `보정 제보 저장 — id=${saved.id}, spot=${dto.spotId}, Star-Index 캐시 무효화(${starKey})`,
    );

    const aggregated = await this.getAggregatedCorrectionScoreForSpot(dto.spotId);
    return {
      id: saved.id,
      spotId: saved.spotId,
      perceivedQuality: saved.perceivedQuality,
      createdAt: saved.createdAt,
      aggregatedCorrectionScore: aggregated,
    };
  }

  async getAggregate(spotId: string) {
    const spot = await this.spots.findById(spotId);
    if (!spot) {
      throw new NotFoundException('해당 spotId의 명소가 없습니다.');
    }
    const count = await this.repo.count({ where: { spotId } });
    const aggregated = await this.getAggregatedCorrectionScoreForSpot(spotId);
    return {
      spotId,
      submissionCount: count,
      aggregatedCorrectionScore: aggregated,
    };
  }
}
