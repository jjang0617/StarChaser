import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CorrectionsService } from '../corrections/corrections.service';

@ApiTags('admin')
@Controller('admin/correction-reports')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminCorrectionReportsController {
  constructor(private readonly correctionsService: CorrectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Star-Index 보정 제보 목록 (관리자)' })
  list() {
    return this.correctionsService.listForAdmin();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Star-Index 보정 제보 삭제 (관리자)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.correctionsService.deleteForAdmin(id);
  }
}
