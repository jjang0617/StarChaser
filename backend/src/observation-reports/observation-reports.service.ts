import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OBSERVATION_REPOSITORY,
  type ObservationRepository,
} from '../common/interfaces/observation.repository';
import type { CreateObservationMismatchReportDto } from './dto/create-observation-mismatch-report.dto';
import {
  ObservationMismatchReportEntity,
  type ObservationMismatchReportStatus,
  type ObservationMismatchType,
} from './observation-mismatch-report.entity';
import { mismatchTypeLabel } from './observation-mismatch.util';

@Injectable()
export class ObservationReportsService {
  private readonly logger = new Logger(ObservationReportsService.name);

  constructor(
    @InjectRepository(ObservationMismatchReportEntity)
    private readonly reports: Repository<ObservationMismatchReportEntity>,
    @Inject(OBSERVATION_REPOSITORY)
    private readonly observations: ObservationRepository,
  ) {}

  async create(userId: string, dto: CreateObservationMismatchReportDto) {
    const observation = await this.observations.findById(dto.observationId);
    if (!observation) {
      throw new NotFoundException('관측 기록을 찾을 수 없습니다.');
    }
    if (observation.userId !== userId) {
      throw new ForbiddenException('본인의 일기만 제보할 수 있습니다.');
    }

    if (dto.mismatchType !== 'felt_score_differs') {
      throw new BadRequestException('지원하지 않는 제보 유형입니다.');
    }

    const existing = await this.reports.findOne({
      where: { observationId: dto.observationId, userId },
    });
    if (existing) {
      throw new ConflictException('이미 제보한 일기입니다.');
    }

    const row = this.reports.create({
      observationId: dto.observationId,
      userId,
      mismatchType: dto.mismatchType,
      message: dto.message?.trim() || null,
      status: 'pending',
    });
    const saved = await this.reports.save(row);
    this.logger.log(
      `불일치 제보 — id=${saved.id}, obs=${dto.observationId}, type=${dto.mismatchType}`,
    );

    return {
      id: saved.id,
      observationId: saved.observationId,
      mismatchType: saved.mismatchType,
      mismatchLabel: mismatchTypeLabel(saved.mismatchType),
      status: saved.status,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async findReportStatusForObservation(userId: string, observationId: string) {
    const row = await this.reports.findOne({
      where: { observationId, userId },
    });
    return row
      ? {
          submitted: true,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        }
      : { submitted: false };
  }

  async listForAdmin(status?: ObservationMismatchReportStatus) {
    const qb = this.reports
      .createQueryBuilder('r')
      .innerJoin('observations', 'o', 'o.id = r.observation_id')
      .innerJoin('users', 'u', 'u.id = r.user_id')
      .select([
        'r.id AS id',
        'r.observation_id AS "observationId"',
        'r.user_id AS "userId"',
        'r.mismatch_type AS "mismatchType"',
        'r.message AS message',
        'r.status AS status',
        'r.reviewed_at AS "reviewedAt"',
        'r.created_at AS "createdAt"',
        'o.title AS "observationTitle"',
        'o.content AS "observationContent"',
        'o.result AS "observationResult"',
        'o.star_index_val AS "starIndexVal"',
        'o.observed_at AS "observedAt"',
        'u.email AS "userEmail"',
        'u.nickname AS "userNickname"',
      ])
      .orderBy('r.created_at', 'DESC');

    if (status) {
      qb.where('r.status = :status', { status });
    }

    const rows = await qb.getRawMany<{
      id: string;
      observationId: string;
      userId: string;
      mismatchType: ObservationMismatchType;
      message: string | null;
      status: ObservationMismatchReportStatus;
      reviewedAt: Date | null;
      createdAt: Date;
      observationTitle: string | null;
      observationContent: string | null;
      observationResult: 'success' | 'partial' | 'fail';
      starIndexVal: number;
      observedAt: Date;
      userEmail: string;
      userNickname: string | null;
    }>();

    return rows.map((row) => ({
      id: row.id,
      observationId: row.observationId,
      userId: row.userId,
      mismatchType: row.mismatchType,
      mismatchLabel: mismatchTypeLabel(row.mismatchType),
      message: row.message,
      status: row.status,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      observation: {
        title: row.observationTitle,
        content: row.observationContent,
        result: row.observationResult,
        starIndexVal: row.starIndexVal,
        observedAt: row.observedAt.toISOString(),
      },
      user: {
        email: row.userEmail,
        nickname: row.userNickname,
      },
    }));
  }

  async updateStatus(id: string, status: ObservationMismatchReportStatus) {
    const row = await this.reports.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('제보를 찾을 수 없습니다.');
    }
    row.status = status;
    row.reviewedAt = status === 'reviewed' ? new Date() : null;
    const saved = await this.reports.save(row);
    return {
      id: saved.id,
      status: saved.status,
      reviewedAt: saved.reviewedAt?.toISOString() ?? null,
    };
  }
}
