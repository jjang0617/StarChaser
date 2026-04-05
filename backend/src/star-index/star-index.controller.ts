import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import { StarIndexService } from './star-index.service';

@ApiTags('star-index')
@Controller('star-index')
export class StarIndexController {
  constructor(private readonly starIndexService: StarIndexService) {}

  // 현재 위치 기반 Star-Index 조회 — 인증 필요 (JwtAuthGuard 샘플 적용)
  // 60초 내 10회 제한 (기상 API 비용 보호)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: '현재 위치 Star-Index 조회 (0~100점) — Bearer access JWT' })
  async getStarIndex(
    @CurrentUser() user: JwtValidatedUser,
    @Query('spotId') spotId: string,
  ) {
    // TODO: 장성재(A) 2~3주차 구현
    // 1. CacheService에서 기상 데이터 조회
    // 2. StarIndexService.calcStarIndex() 호출
    // 3. 결과 반환
    return {
      spotId,
      score: 0,
      message: '구현 예정',
      requestedBy: user.email,
    };
  }
  @Get('poc-test')
  async pocTest() {
    await this.starIndexService.testApiConnections();
    return { message: '로그 확인하세요' };
  }
}
