import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CronService } from './cron.service';

@ApiTags('cron')
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @Post('run-once')
  @ApiOperation({
    summary: 'Cron 수동 실행 (개발 검증용)',
    description: '기상·미세먼지·달 캐시 수집을 1회 실행합니다.',
  })
  async runOnce() {
    await this.cronService.runCollectionOnce();
    return { message: 'Cron 수집 실행 완료' };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
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
