import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('search')
  @ApiOperation({ summary: '명소 검색 (tsvector + pg_trgm + ILIKE 하이브리드)' })
  search(
    @Query('q') q: string,
    @Query('limit') limit = '20',
  ) {
    return this.spots.search(q ?? '', Number(limit) || 20);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({
    summary: '단일 명소 — Star-Index 없이도 천구·지도에 쓸 위경도 조회',
  })
  async findOne(@Param('id') id: string) {
    const spot = await this.spots.findById(id);
    if (!spot) {
      throw new NotFoundException('명소를 찾을 수 없습니다.');
    }
    return spot;
  }
}
