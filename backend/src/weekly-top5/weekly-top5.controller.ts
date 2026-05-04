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
    summary: '주간 TOP5 조회 (지난주 월~일 집계, week_start = 그 주의 월요일)',
    description:
      '`weekStart` 생략 시 DB에 존재하는 가장 최근 `week_start`로 조회합니다. ' +
      '해당 주 데이터가 없으면 빈 배열 `[]`을 반환합니다.',
  })
  @ApiQuery({
    name: 'weekStart',
    required: false,
    description: '조회할 week_start (YYYY-MM-DD, 집계 구간의 월요일)',
    example: '2026-04-28',
  })
  @ApiOkResponse({ type: WeeklyTop5ItemDto, isArray: true })
  async getWeekly(
    @Query('weekStart') weekStart?: string,
  ): Promise<WeeklyTop5ItemDto[]> {
    return this.weeklyTop5Service.getWeekly(weekStart);
  }
}
