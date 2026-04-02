import { Controller, Get, Query } from '@nestjs/common';
import { SkyService } from './sky.service';

@Controller('sky')
export class SkyController {
  constructor(private readonly skyService: SkyService) {}

  @Get('moon')
  async getMoonData(@Query('date') date: string) {
    // date 없으면 오늘 날짜 자동으로 사용
    const today = date ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return this.skyService.getMoonData(today);
  }
}
