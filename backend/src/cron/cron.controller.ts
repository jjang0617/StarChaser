import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CronService } from './cron.service';
import { WeeklyTop3AggregationService } from '../weekly-top3/weekly-top3-aggregation.service';

@ApiTags('cron')
@Controller('cron')
export class CronController {
  constructor(
    private readonly cronService: CronService,
    private readonly weeklyTop3Aggregation: WeeklyTop3AggregationService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('run-once')
  @ApiOperation({
    summary: 'Cron 수동 실행 (개발 검증용)',
    description:
      '`job` 없음 또는 `weather`: 기상·미세먼지·달 캐시 수집. ' +
      '`todayStarIndexSnapshot`: KST **오늘** 명소별 Star-Index 점수를 캐시 기준으로 `spot_star_index_daily`에 upsert. ' +
      '`weeklyTop3`: 일별 평균 TOP3 저장. `weekStart` 생략=직전 완료 주, 지정=해당 날짜가 속한 KST 주(월~일).',
  })
  @ApiQuery({
    name: 'job',
    required: false,
    enum: ['weather', 'todayStarIndexSnapshot', 'weeklyTop3'],
  })
  @ApiQuery({
    name: 'weekStart',
    required: false,
    description:
      '`job=weeklyTop3`일 때만 사용. YYYY-MM-DD — 그 날짜가 속한 주의 월요일로 정규화 후 그 주를 집계.',
    example: '2026-04-28',
  })
  async runOnce(
    @Query('job') job?: string,
    @Query('weekStart') weekStart?: string,
  ) {
    if (job === 'weeklyTop3') {
      const r =
        await this.weeklyTop3Aggregation.aggregateWeekTop3FromDaily(weekStart);
      return { message: '주간 TOP3 집계 완료', ...r };
    }
    if (job === 'todayStarIndexSnapshot') {
      const r =
        await this.weeklyTop3Aggregation.snapshotTodayStarIndexScores();
      return { message: '오늘(KST) 일별 Star-Index 스냅샷 완료', ...r };
    }
    await this.cronService.runCollectionOnce();
    return { message: 'Cron 수집 실행 완료' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('cache-status')
  @ApiOperation({
    summary: 'Star-Index용 캐시 키 존재 여부 확인',
    description:
      'weather 키는 lat/lng→격자(nx,ny)로 결정됨. 비우면 서울 시청 근처 기본값.',
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    example: 37.1833,
    description: '명소 위도 (WGS84)',
  })
  @ApiQuery({
    name: 'lng',
    required: false,
    example: 128.75,
    description: '명소 경도 (WGS84)',
  })
  cacheStatus(
    @Query('lat') lat = '37.5665',
    @Query('lng') lng = '126.978',
  ) {
    return this.cronService.getCacheStatus(Number(lat), Number(lng));
  }
}
