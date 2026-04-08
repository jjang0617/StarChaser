import {
  BadRequestException,
  Injectable,
  Inject,
  Logger,
} from '@nestjs/common';
import type { WeatherSnapshot } from '../common/interfaces/weather-snapshot';
import {
  assertValidWeatherSnapshotScores,
  normalizeWeatherSnapshotForStorage,
  WeatherSnapshotValidationError,
} from '../common/interfaces/weather-snapshot';
import {
  OBSERVATION_REPOSITORY,
  type ObservationRepository,
} from '../common/interfaces/observation.repository';
import type { CreateObservationDto } from './dto/create-observation.dto';

@Injectable()
export class ObservationService {
  private readonly logger = new Logger(ObservationService.name);

  constructor(
    @Inject(OBSERVATION_REPOSITORY)
    private readonly observations: ObservationRepository,
  ) {}

  /**
   * Observation 저장 전 weather_snapshot 10키·0~100 검증 후 정규화 저장
   * (DB CHECK와 이중 방어)
   */
  async create(userId: string, dto: CreateObservationDto) {
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
      observedAt: new Date(),
    });

    this.logger.log(`Observation 저장 — id=${saved.id}, user=${userId}`);
    return saved;
  }

  async findByUserId(userId: string) {
    return this.observations.findByUserId(userId);
  }
}
