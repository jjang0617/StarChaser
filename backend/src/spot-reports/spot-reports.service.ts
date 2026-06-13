import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StarIndexService } from '../star-index/star-index.service';
import type { CreateSpotReportDto } from './dto/create-spot-report.dto';
import { SpotReportEntity } from './spot-report.entity';

@Injectable()
export class SpotReportsService {
  private readonly logger = new Logger(SpotReportsService.name);

  constructor(
    @InjectRepository(SpotReportEntity)
    private readonly repo: Repository<SpotReportEntity>,
    private readonly starIndex: StarIndexService,
  ) {}

  async create(userId: string, dto: CreateSpotReportDto) {
    const message = dto.message.trim();
    if (!message) {
      throw new BadRequestException('명소 설명을 입력해 주세요.');
    }

    let starResult;
    try {
      starResult = await this.starIndex.calculateForLatLngFromCache(
        dto.lat,
        dto.lng,
      );
    } catch (e) {
      if (e instanceof ServiceUnavailableException) {
        throw e;
      }
      throw new ServiceUnavailableException(
        '현재 위치의 Star-Index를 계산하지 못했습니다.',
      );
    }

    const row = this.repo.create({
      userId,
      latitude: dto.lat,
      longitude: dto.lng,
      message,
      placeLabel: dto.placeLabel?.trim() || null,
      starIndexVal: starResult.score,
      weatherSnapshot: starResult.weatherSnapshot,
    });
    const saved = await this.repo.save(row);
    this.logger.log(`명소 제보 — id=${saved.id}, user=${userId}`);

    return {
      id: saved.id,
      starIndexVal: saved.starIndexVal,
      latitude: saved.latitude,
      longitude: saved.longitude,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async listForAdmin() {
    const rows = await this.repo
      .createQueryBuilder('r')
      .innerJoin('users', 'u', 'u.id = r.user_id')
      .select([
        'r.id AS id',
        'r.user_id AS "userId"',
        'r.latitude AS latitude',
        'r.longitude AS longitude',
        'r.message AS message',
        'r.place_label AS "placeLabel"',
        'r.star_index_val AS "starIndexVal"',
        'r.weather_snapshot AS "weatherSnapshot"',
        'r.created_at AS "createdAt"',
        'u.email AS "userEmail"',
        'u.nickname AS "userNickname"',
      ])
      .orderBy('r.created_at', 'DESC')
      .getRawMany<{
        id: string;
        userId: string;
        latitude: number;
        longitude: number;
        message: string;
        placeLabel: string | null;
        starIndexVal: number;
        weatherSnapshot: SpotReportEntity['weatherSnapshot'];
        createdAt: Date;
        userEmail: string;
        userNickname: string | null;
      }>();

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      latitude: row.latitude,
      longitude: row.longitude,
      message: row.message,
      placeLabel: row.placeLabel,
      starIndexVal: row.starIndexVal,
      weatherSnapshot: row.weatherSnapshot,
      createdAt: row.createdAt.toISOString(),
      user: {
        email: row.userEmail,
        nickname: row.userNickname,
      },
    }));
  }

  async delete(id: string): Promise<{ message: string }> {
    const result = await this.repo.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('제보를 찾을 수 없습니다.');
    }
    this.logger.log(`명소 제보 삭제 — id=${id}`);
    return { message: '삭제했습니다.' };
  }
}
