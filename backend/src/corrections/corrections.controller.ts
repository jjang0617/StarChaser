import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import { CorrectionsService } from './corrections.service';
import { CreateCorrectionSubmissionDto } from './dto/create-correction-submission.dto';

@ApiTags('corrections')
@Controller('corrections')
export class CorrectionsController {
  constructor(private readonly correctionsService: CorrectionsService) {}

  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({
    summary:
      'Star-Index 보정 제보 — 현장 체감 점수(0~100) 저장 후 해당 spot Star-Index 캐시 무효화',
  })
  @ApiNotFoundResponse({ description: 'spotId 없음' })
  create(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: CreateCorrectionSubmissionDto,
  ) {
    return this.correctionsService.create(user.userId, dto);
  }

  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('aggregate')
  @ApiOperation({ summary: '명소별 보정 제보 건수' })
  @ApiNotFoundResponse({ description: 'spotId 없음' })
  getAggregate(
    @Query('spotId', new ParseUUIDPipe({ version: '4' })) spotId: string,
  ) {
    return this.correctionsService.getAggregate(spotId);
  }
}
