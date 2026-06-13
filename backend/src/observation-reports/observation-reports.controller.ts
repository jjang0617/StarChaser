import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import { CreateObservationMismatchReportDto } from './dto/create-observation-mismatch-report.dto';
import { ObservationReportsService } from './observation-reports.service';

@ApiTags('observation-reports')
@Controller('observation-reports')
export class ObservationReportsController {
  constructor(private readonly reportsService: ObservationReportsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Star-Index·관측 결과 불일치 제보' })
  create(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: CreateObservationMismatchReportDto,
  ) {
    return this.reportsService.create(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('status/:observationId')
  @ApiOperation({ summary: '내 일기 제보 여부' })
  status(
    @CurrentUser() user: JwtValidatedUser,
    @Param('observationId', ParseUUIDPipe) observationId: string,
  ) {
    return this.reportsService.findReportStatusForObservation(user.userId, observationId);
  }
}
