import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateObservationMismatchReportStatusDto } from '../observation-reports/dto/update-observation-mismatch-report-status.dto';
import { ObservationReportsService } from '../observation-reports/observation-reports.service';
import type { ObservationMismatchReportStatus } from '../observation-reports/observation-mismatch-report.entity';

@ApiTags('admin')
@Controller('admin/observation-reports')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminObservationReportsController {
  constructor(private readonly reportsService: ObservationReportsService) {}

  @Get()
  @ApiOperation({ summary: '불일치 제보 목록 (관리자)' })
  list(@Query('status') status?: ObservationMismatchReportStatus) {
    return this.reportsService.listForAdmin(status);
  }

  @Patch(':id')
  @ApiOperation({ summary: '제보 상태 변경 (관리자)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateObservationMismatchReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, dto.status);
  }
}
