import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WeeklyTop3Service } from './weekly-top3.service';
import { WeeklyTop3ItemDto } from './dto/weekly-top3-item.dto';

@ApiTags('top3')
@Controller('top3')
export class WeeklyTop3Controller {
  constructor(private readonly weeklyTop3Service: WeeklyTop3Service) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('weekly')
  @ApiOperation({
    summary: '주간 TOP3 조회',
    description:
      '저장된 `weekly_top3`만 조회. `weekStart` 생략 시 최근 `week_start`, 없으면 `[]`.',
  })
  @ApiQuery({
    name: 'weekStart',
    required: false,
    description: '그 주 월요일 YYYY-MM-DD. 생략 시 최근 집계 주.',
    example: '2026-04-28',
  })
  @ApiOkResponse({ type: WeeklyTop3ItemDto, isArray: true })
  async getWeekly(
    @Query('weekStart') weekStart?: string,
  ): Promise<WeeklyTop3ItemDto[]> {
    return this.weeklyTop3Service.getWeekly(weekStart);
  }
}
