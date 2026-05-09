import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';
import { StarIndexService } from './star-index.service';

@ApiTags('star-index')
@Controller('star-index')
export class StarIndexController {
  constructor(
    private readonly starIndexService: StarIndexService,
    @Inject(SPOT_REPOSITORY)
    private readonly spots: SpotRepository,
  ) {}

  // 현재 위치 기반 Star-Index 조회 — 인증 필요 (JwtAuthGuard 샘플 적용)
  // 60초 내 10회 제한 (기상 API 비용 보호)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({
    summary:
      'Star-Index 조회 (0~100) — spotId(명소 UUID) 또는 lat·lng(GPS 격자 기상 + 주변 명소 Bortle/고도)',
  })
  @ApiNotFoundResponse({ description: 'spotId에 해당하는 명소 없음' })
  async getStarIndex(
    @CurrentUser() user: JwtValidatedUser,
    @Query('spotId') spotId?: string,
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
  ) {
    const sid = spotId?.trim();
    if (sid) {
      const spot = await this.spots.findById(sid);
      if (!spot) {
        throw new NotFoundException('해당 spotId의 명소가 없습니다.');
      }
      const { score, weatherSnapshot, cacheKeys } =
        await this.starIndexService.calculateForSpotFromCache(spot);
      return {
        spotId: spot.id,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        elevationM: spot.elevationM,
        bortleClass: spot.bortleClass,
        score,
        weatherSnapshot,
        cacheKeys,
        message:
          '캐시(weather/dust/moon) 기반 Star-Index 계산 완료 — weather_snapshot 10키 합의 스키마',
        requestedBy: user.email,
      };
    }

    const lat =
      latRaw !== undefined && latRaw !== '' ? Number(latRaw) : Number.NaN;
    const lng =
      lngRaw !== undefined && lngRaw !== '' ? Number(lngRaw) : Number.NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException(
        'spotId 또는 유효한 lat·lng 쌍을 query에 넣어 주세요.',
      );
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('lat·lng 범위가 올바르지 않습니다.');
    }

    const { score, weatherSnapshot, cacheKeys, nearestSpot, distanceKm } =
      await this.starIndexService.calculateForLatLngFromCache(lat, lng);

    const nameSuffix =
      nearestSpot && distanceKm != null
        ? ` — Bortle/고도: ${nearestSpot.name} (${distanceKm.toFixed(1)}km)`
        : ' — Bortle/고도: 기본값(주변 명소 없음)';

    return {
      spotId: nearestSpot?.id,
      name: `현재 위치 격자${nameSuffix}`,
      lat,
      lng,
      elevationM: nearestSpot?.elevationM ?? 100,
      bortleClass: nearestSpot?.bortleClass ?? 5,
      score,
      weatherSnapshot,
      cacheKeys,
      message:
        'GPS 좌표 격자 기상 + (가능 시) 가장 가까운 명소 광공해·해발·보정으로 계산',
      requestedBy: user.email,
    };
  }
  @Get('poc-test')
  async pocTest() {
    await this.starIndexService.testApiConnections();
    return { message: '로그 확인하세요' };
  }
}
