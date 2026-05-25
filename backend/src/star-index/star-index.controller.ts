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
import { buildStarIndexCardDisplay } from '../common/weather-snapshot-display.util';
import { StarIndexService } from './star-index.service';
import { parseObservationTime } from './star-index-scoring.util';

@ApiTags('star-index')
@Controller('star-index')
export class StarIndexController {
  constructor(
    private readonly starIndexService: StarIndexService,
    @Inject(SPOT_REPOSITORY)
    private readonly spots: SpotRepository,
  ) {}

  /** 지도 클러스터 목록용 — 요청 1회로 여러 UUID 점수 (쉼표 구분, 최대 40) */
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('spot-scores')
  @ApiOperation({
    summary: '등록된 명소 여러 곳의 현재 Star-Index 점수',
  })
  async getSpotScores(
    @CurrentUser() user: JwtValidatedUser,
    @Query('ids') idsRaw?: string,
  ) {
    const raw = idsRaw?.trim();
    if (!raw) {
      throw new BadRequestException('ids=uuid1,uuid2,... 형식이 필요합니다.');
    }
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40);

    const spots = (
      await Promise.all(ids.map((id) => this.spots.findById(id)))
    ).filter((s): s is NonNullable<typeof s> => s != null);

    const items = await this.starIndexService.calculateSpotScoresBatch(spots);

    return {
      items,
      requestedBy: user.email,
    };
  }

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
    @Query('at') atRaw?: string,
  ) {
    const atUtc = parseObservationTime(atRaw);
    if (atRaw?.trim() && !atUtc) {
      throw new BadRequestException(
        'at은 ISO 8601 시각(예: 2026-05-17T14:30:00.000Z)이어야 합니다.',
      );
    }

    const sid = spotId?.trim();
    if (sid) {
      const spot = await this.spots.findById(sid);
      if (!spot) {
        throw new NotFoundException('해당 spotId의 명소가 없습니다.');
      }
      const result =
        await this.starIndexService.calculateForSpotFromCache(spot, atUtc);
      const display = buildStarIndexCardDisplay(result.weatherSnapshot);
      return {
        spotId: spot.id,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        elevationM: spot.elevationM,
        bortleClass: spot.bortleClass,
        score: result.score,
        weatherSnapshot: result.weatherSnapshot,
        display,
        cacheKeys: result.cacheKeys,
        isStale: result.isStale ?? false,
        cachedAt: result.cachedAt,
        source: result.isStale ? 'stale_cache' : 'live',
        message: result.isStale
          ? '실시간 기상 캐시가 없어 직전 계산값을 표시합니다.'
          : '캐시(weather/dust/moon) 기반 Star-Index 계산 완료 — weather_snapshot 10키 합의 스키마',
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

    const result = await this.starIndexService.calculateForLatLngFromCache(
      lat,
      lng,
      atUtc,
    );
    const display = buildStarIndexCardDisplay(result.weatherSnapshot);

    const { nearestSpot, distanceKm } = result;
    let detailMsg =
      nearestSpot && distanceKm != null
        ? `격자 기상 + 주변 참고: ${nearestSpot.name} (약 ${distanceKm.toFixed(1)}km) — 앱에서 행정구역 이름은 역지오코딩으로 표시합니다.`
        : '격자 기상 + 기본 광공해·고도';
    if (result.isStale && nearestSpot) {
      detailMsg = `실시간 캐시 없음 — ${nearestSpot.name} 직전 계산값 참고 (약 ${distanceKm?.toFixed(1) ?? '?'}km)`;
    }

    return {
      spotId: nearestSpot?.id,
      /** 표시용 짧은 이름 — 상세 지명은 클라이언트 역지오코딩 권장 */
      name: '현재 좌표',
      lat,
      lng,
      elevationM: nearestSpot?.elevationM ?? 100,
      bortleClass: nearestSpot?.bortleClass ?? 5,
      score: result.score,
      weatherSnapshot: result.weatherSnapshot,
      display,
      cacheKeys: result.cacheKeys,
      isStale: result.isStale ?? false,
      cachedAt: result.cachedAt,
      source: result.isStale ? 'stale_cache' : 'live',
      message: detailMsg,
      requestedBy: user.email,
    };
  }
  @Get('poc-test')
  async pocTest() {
    await this.starIndexService.testApiConnections();
    return { message: '로그 확인하세요' };
  }
}
