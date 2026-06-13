import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import { CreateSpotReportDto } from './dto/create-spot-report.dto';
import { SpotReportsService } from './spot-reports.service';

@ApiTags('spot-reports')
@Controller('spot-reports')
export class SpotReportsController {
  constructor(private readonly spotReportsService: SpotReportsService) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '명소 제보 — GPS + Star-Index 스냅샷 저장' })
  create(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: CreateSpotReportDto,
  ) {
    return this.spotReportsService.create(user.userId, dto);
  }
}
