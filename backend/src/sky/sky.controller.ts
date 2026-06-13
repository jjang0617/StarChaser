import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkyViewQueryDto } from './dto/sky-view-query.dto';
import { SkyService } from './sky.service';

@ApiTags('sky')
@Controller('sky')
export class SkyController {
  constructor(private readonly skyService: SkyService) {}

  @Throttle({ default: { ttl: 60000, limit: 120 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('view')
  @ApiOperation({
    summary:
      '천구 — 위도·경도·시각(UT) 기준 별(hip) + 달·금성·목성(astronomy-engine) 지평선 + 별자리 라벨',
  })
  getSkyView(@Query() q: SkyViewQueryDto) {
    const when = q.at ? new Date(q.at) : new Date();
    return this.skyService.buildSkyView(q.lat, q.lng, when);
  }

  @Throttle({ default: { ttl: 60000, limit: 120 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('constellation-lines')
  @ApiOperation({
    summary:
      '별자리 연결선 MVP — HIP 번호 쌍(적위 epoch는 응답 epoch 참고, 정적 JSON)',
  })
  getConstellationLines() {
    return this.skyService.getConstellationLines();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('stars')
  @ApiOperation({
    summary: 'Hipparcos 부분집합 적경·적위·등급(시각·위치 미반영 레거시 호환)',
  })
  getStarsMvp() {
    return this.skyService.getStaticStarsMvp();
  }

  @Get('moon')
  async getMoonData(@Query('date') date: string) {
    // date 없으면 오늘 날짜 자동으로 사용
    const today = date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return this.skyService.getMoonData(today);
  }
}
