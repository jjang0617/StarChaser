import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WeeklyTop5Service } from './weekly-top5.service';
import { WeeklyTop5ItemDto } from './dto/weekly-top5-item.dto';

@ApiTags('top5')
@Controller('top5')
export class WeeklyTop5Controller {
  constructor(private readonly weeklyTop5Service: WeeklyTop5Service) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('weekly')
  @ApiOperation({
    summary: '주간 TOP5 조회',
    description:
      '저장된 `weekly_top5`만 조회. `weekStart` 생략 시 최근 `week_start`, 없으면 `[]`.',
  })
  @ApiQuery({
    name: 'weekStart',
    required: false,
    description: '그 주 월요일 YYYY-MM-DD. 생략 시 최근 집계 주.',
    example: '2026-04-28',
  })
  @ApiOkResponse({ type: WeeklyTop5ItemDto, isArray: true })
  async getWeekly(
    @Query('weekStart') weekStart?: string,
  ): Promise<WeeklyTop5ItemDto[]> {
    return this.weeklyTop5Service.getWeekly(weekStart);
  }
}
