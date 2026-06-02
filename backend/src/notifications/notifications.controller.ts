import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import { DeactivateNotificationTokenDto } from './dto/deactivate-notification-token.dto';
import { NotificationTestSendDto } from './dto/notification-test-send.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpsertNotificationTokenDto } from './dto/upsert-notification-token.dto';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
    private readonly notificationScheduler: NotificationSchedulerService,
  ) {}

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

  @Post('test-send')
  @ApiOperation({
    summary:
      'FCM 실발송 검증(개발) — 본인 활성 토큰으로 전송. production 은 FCM_TEST_SEND_ENABLED=true 만 허용',
  })
  testSend(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: NotificationTestSendDto,
  ) {
    return this.notificationsService.sendTestPush(user.userId, dto);
  }

  @Post('dev/run-star-index-scheduled-push')
  @ApiOperation({
    summary:
      '개발·검증용: Star-Index 스케줄 잡을 즉시 1회 실행 (:15 기다리지 않음). production 은 FCM_STAR_INDEX_MANUAL_TRIGGER_ENABLED=true 만 허용',
  })
  async runStarIndexScheduledPush(@CurrentUser() user: JwtValidatedUser) {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const forced =
      this.config.get<string>('FCM_STAR_INDEX_MANUAL_TRIGGER_ENABLED') === 'true';
    const allowed = forced || nodeEnv !== 'production';
    if (!allowed) {
      throw new ForbiddenException(
        'production 에서는 FCM_STAR_INDEX_MANUAL_TRIGGER_ENABLED=true 일 때만 사용 가능',
      );
    }
    await this.notificationScheduler.sendStarIndexThresholdDigest();
    return {
      ok: true,
      triggeredBy: user.userId,
      message:
        'Star-Index 스케줄 로직을 1회 실행했습니다. 서버 로그([Star-Index push])를 확인하세요.',
    };
  }

  @Post('dev/run-top3-scheduled-push')
  @ApiOperation({
    summary:
      '개발·검증용: 주간 TOP3 스케줄 푸시를 즉시 1회 실행. production 은 FCM_TOP3_MANUAL_TRIGGER_ENABLED=true 만 허용',
  })
  async runTop3ScheduledPush(@CurrentUser() user: JwtValidatedUser) {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const forced =
      this.config.get<string>('FCM_TOP3_MANUAL_TRIGGER_ENABLED') === 'true';
    const allowed = forced || nodeEnv !== 'production';
    if (!allowed) {
      throw new ForbiddenException(
        'production 에서는 FCM_TOP3_MANUAL_TRIGGER_ENABLED=true 일 때만 사용 가능',
      );
    }
    await this.notificationScheduler.sendWeeklyTop3Digest();
    return {
      ok: true,
      triggeredBy: user.userId,
      message:
        '주간 TOP3 스케줄 로직을 1회 실행했습니다. 서버 로그([TOP3 push])를 확인하세요.',
    };
  }

}
