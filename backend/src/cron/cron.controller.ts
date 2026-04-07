import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CronService } from './cron.service';

@ApiTags('cron')
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('run-once')
  @ApiOperation({ summary: '기상/미세먼지/달 캐시 수집 즉시 실행 (개발 검증용)' })
  async runOnce() {
    await this.cronService.runCollectionOnce();
    return { message: 'Cron 수집 실행 완료' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('cache-status')
  @ApiOperation({ summary: 'Star-Index용 캐시 키 존재 여부 확인' })
  cacheStatus(
    @Query('lat') lat = '37.5665',
    @Query('lng') lng = '126.978',
  ) {
    return this.cronService.getCacheStatus(Number(lat), Number(lng));
  }
}
