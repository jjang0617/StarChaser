import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import { CreateObservationDto } from './dto/create-observation.dto';
import { ObservationService } from './observation.service';

@ApiTags('observations')
@Controller('observations')
export class ObservationsController {
  constructor(private readonly observationService: ObservationService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({
    summary:
      '관측 기록 저장 — weather_snapshot 10 score 키 검증 후 JSONB 저장',
  })
  create(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: CreateObservationDto,
  ) {
    return this.observationService.create(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: '내 관측 기록 목록' })
  findMine(@CurrentUser() user: JwtValidatedUser) {
    return this.observationService.findByUserId(user.userId);
  }
}
