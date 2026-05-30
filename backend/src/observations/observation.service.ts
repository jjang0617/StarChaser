import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { WeatherSnapshot } from '../common/interfaces/weather-snapshot';
import {
  assertValidWeatherSnapshotScores,
  normalizeWeatherSnapshotForStorage,
  WeatherSnapshotValidationError,
} from '../common/interfaces/weather-snapshot';
import {
  OBSERVATION_REPOSITORY,
  type Observation,
  type ObservationRepository,
} from '../common/interfaces/observation.repository';
import {
  PHOTO_REPOSITORY,
  type PhotoRepository,
} from '../common/interfaces/photo.repository';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import type { CreateObservationDto } from './dto/create-observation.dto';
import type { ObservationResponseDto } from './dto/observation-response.dto';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class ObservationService {
  private readonly logger = new Logger(ObservationService.name);

  constructor(
    @Inject(OBSERVATION_REPOSITORY)
    private readonly observations: ObservationRepository,
    @Inject(PHOTO_REPOSITORY)
    private readonly photos: PhotoRepository,
    private readonly storage: SupabaseStorageService,
  ) {}

  /**
   * Observation 저장 전 weather_snapshot 10키·0~100 검증 후 정규화 저장
   * (DB CHECK와 이중 방어)
   */
  async create(
    userId: string,
    dto: CreateObservationDto,
  ): Promise<ObservationResponseDto> {
    try {
      assertValidWeatherSnapshotScores(dto.weatherSnapshot);
    } catch (e) {
      if (e instanceof WeatherSnapshotValidationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const weatherSnapshot = normalizeWeatherSnapshotForStorage(
      dto.weatherSnapshot as WeatherSnapshot,
    );

    const saved = await this.observations.save({
      userId,
      spotId: dto.spotId ?? null,
      starIndexVal: dto.starIndexVal,
      weatherSnapshot,
      result: dto.result,
      title: dto.title?.trim() || null,
      content: dto.content?.trim() || null,
      observedAt: new Date(),
    });

    this.logger.log(`Observation 저장 — id=${saved.id}, user=${userId}`);
    return this.toResponse(saved, []);
  }

  async findByUserId(userId: string): Promise<ObservationResponseDto[]> {
    const rows = await this.observations.findByUserId(userId);
    const photoRows = await this.photos.findByObservationIds(rows.map((r) => r.id));
    const photosByObs = new Map<string, typeof photoRows>();
    for (const p of photoRows) {
      const list = photosByObs.get(p.observationId) ?? [];
      list.push(p);
      photosByObs.set(p.observationId, list);
    }
    return rows.map((row) =>
      this.toResponse(row, photosByObs.get(row.id) ?? []),
    );
  }

  async uploadPhoto(
    userId: string,
    observationId: string,
    file: Express.Multer.File,
  ): Promise<ObservationResponseDto> {
    const observation = await this.requireOwnedObservation(userId, observationId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('업로드할 파일이 없습니다.');
    }
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (!ALLOWED_IMAGE_MIMES.has(mime)) {
      throw new BadRequestException('JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('사진은 5MB 이하만 업로드할 수 있습니다.');
    }

    const photoId = randomUUID();
    const imageUrl = await this.storage.uploadDiaryPhoto(
      userId,
      observationId,
      photoId,
      file.buffer,
      mime,
    );
    await this.photos.save({
      observationId,
      imageUrl,
      caption: null,
      takenAt: null,
    });

    const allPhotos = await this.photos.findByObservationIds([observationId]);
    return this.toResponse(observation, allPhotos);
  }

  async delete(userId: string, observationId: string): Promise<{ message: string }> {
    await this.requireOwnedObservation(userId, observationId);
    await this.storage.removeDiaryPhotos(userId, observationId);
    await this.photos.deleteByObservationId(observationId);
    await this.observations.deleteById(observationId);
    this.logger.log(`Observation 삭제 — id=${observationId}, user=${userId}`);
    return { message: '삭제했습니다.' };
  }

  private async requireOwnedObservation(
    userId: string,
    observationId: string,
  ): Promise<Observation> {
    const row = await this.observations.findById(observationId);
    if (!row) {
      throw new NotFoundException('관측 기록을 찾을 수 없습니다.');
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('본인의 기록만 수정할 수 있습니다.');
    }
    return row;
  }

  private toResponse(
    row: Observation,
    photoRows: { id: string; imageUrl: string }[],
  ): ObservationResponseDto {
    return {
      id: row.id,
      userId: row.userId,
      spotId: row.spotId,
      starIndexVal: row.starIndexVal,
      weatherSnapshot: row.weatherSnapshot,
      result: row.result,
      title: row.title,
      content: row.content,
      observedAt: row.observedAt.toISOString(),
      photos: photoRows.map((p) => ({ id: p.id, imageUrl: p.imageUrl })),
    };
  }
}
