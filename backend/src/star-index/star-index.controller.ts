import {
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
      '명소 기준 Star-Index 조회 (0~100점) — Bearer access JWT, spotId=spots.id UUID',
  })
  @ApiNotFoundResponse({ description: 'spotId에 해당하는 명소 없음' })
  async getStarIndex(
    @CurrentUser() user: JwtValidatedUser,
    @Query('spotId') spotId: string,
  ) {
    const spot = await this.spots.findById(spotId);
    if (!spot) {
      throw new NotFoundException('해당 spotId의 명소가 없습니다.');
    }
    const { score, cacheKeys } =
      await this.starIndexService.calculateForSpotFromCache(spot);
    return {
      spotId: spot.id,
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      elevationM: spot.elevationM,
      bortleClass: spot.bortleClass,
      score,
      cacheKeys,
      message: '캐시(weather/dust/moon) 기반 Star-Index 계산 완료',
      requestedBy: user.email,
    };
  }
  @Get('poc-test')
  async pocTest() {
    await this.starIndexService.testApiConnections();
    return { message: '로그 확인하세요' };
  }
}
