import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import { CreateObservationDto } from './dto/create-observation.dto';
import { ObservationResponseDto } from './dto/observation-response.dto';
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
      '관측 일기 저장 — weather_snapshot 10 score 키 검증 후 JSONB 저장',
  })
  create(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: CreateObservationDto,
  ): Promise<ObservationResponseDto> {
    return this.observationService.create(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: '내 관측 일기 목록 (사진 포함)' })
  findMine(@CurrentUser() user: JwtValidatedUser): Promise<ObservationResponseDto[]> {
    return this.observationService.findByUserId(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/photos')
  @ApiOperation({ summary: '관측 일기 사진 업로드 (Supabase Storage)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadPhoto(
    @CurrentUser() user: JwtValidatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ObservationResponseDto> {
    return this.observationService.uploadPhoto(user.userId, id, file);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: '관측 일기 삭제' })
  delete(
    @CurrentUser() user: JwtValidatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    return this.observationService.delete(user.userId, id);
  }
}
