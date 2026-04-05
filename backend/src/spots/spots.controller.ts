import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';

/** 샘플 명소·반경 조회 검증용 — 프로덕션에서는 라우트·권한 정책 팀 합의 */
@ApiTags('spots')
@Controller('spots')
export class SpotsController {
  constructor(
    @Inject(SPOT_REPOSITORY)
    private readonly spots: SpotRepository,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: '전체 명소 목록 (DB 연동·시딩 검증)' })
  findAll() {
    return this.spots.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('nearby')
  @ApiOperation({
    summary:
      '반경 내 명소 — ST_DWithin (lat, lng: WGS84, radiusM: 미터, 예: 30000)',
  })
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusM') radiusM = '30000',
  ) {
    return this.spots.findNearby(
      Number(lat),
      Number(lng),
      Number(radiusM) || 30000,
    );
  }
}
