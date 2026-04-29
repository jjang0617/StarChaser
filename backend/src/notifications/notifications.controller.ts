import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import { DeactivateNotificationTokenDto } from './dto/deactivate-notification-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpsertNotificationTokenDto } from './dto/upsert-notification-token.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('token')
  @ApiOperation({ summary: 'FCM 토큰 등록/갱신 (로그인 후 디바이스별 호출)' })
  upsertToken(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: UpsertNotificationTokenDto,
  ) {
    return this.notificationsService.upsertToken(user.userId, dto);
  }

  @Delete('token')
  @ApiOperation({ summary: 'FCM 토큰 비활성화 (로그아웃/알림 해제)' })
  async deactivateToken(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: DeactivateNotificationTokenDto,
  ) {
    await this.notificationsService.deactivateToken(user.userId, dto.fcmToken);
    return { message: '토큰 비활성화 완료' };
  }

  @Get('preferences')
  @ApiOperation({ summary: '내 알림 설정 조회' })
  getPreferences(@CurrentUser() user: JwtValidatedUser) {
    return this.notificationsService.getPreference(user.userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: '내 알림 설정 저장/갱신 (온보딩 토글 연동)' })
  updatePreferences(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.upsertPreference(user.userId, dto);
  }
}
