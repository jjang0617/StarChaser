import { Controller, Delete, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpotReportsService } from '../spot-reports/spot-reports.service';

@ApiTags('admin')
@Controller('admin/spot-reports')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminSpotReportsController {
  constructor(private readonly spotReportsService: SpotReportsService) {}

  @Get()
  @ApiOperation({ summary: '명소 제보 목록 (관리자)' })
  list() {
    return this.spotReportsService.listForAdmin();
  }

  @Delete(':id')
  @ApiOperation({ summary: '명소 제보 삭제 (관리자)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.spotReportsService.delete(id);
  }
}
