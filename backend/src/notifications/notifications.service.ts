import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationPreference,
  type NotificationRepository,
} from '../common/interfaces/notification.repository';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { normalizeStarIndexAlertThreshold } from './star-index-alert-threshold';
import type { NotificationTestSendDto } from './dto/notification-test-send.dto';
import {
  NotificationHistoryItemDto,
  NotificationHistoryResponseDto,
} from './dto/notification-history-item.dto';
import { ReportObserverLocationDto } from './dto/report-observer-location.dto';
import { UpsertNotificationTokenDto } from './dto/upsert-notification-token.dto';
import { FcmPushService } from './fcm-push.service';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
    private readonly fcm: FcmPushService,
    private readonly config: ConfigService,
  ) {}

  upsertToken(userId: string, dto: UpsertNotificationTokenDto) {
    return this.notifications.upsertToken({
      userId,
      fcmToken: dto.fcmToken,
      platform: dto.platform,
    });
  }

  async deactivateToken(userId: string, fcmToken: string): Promise<void> {
    await this.notifications.deactivateToken({ userId, fcmToken });
  }

  async getPreference(userId: string): Promise<NotificationPreference> {
    const pref = await this.notifications.getPreferenceByUserId(userId);
    if (pref) return pref;
    return this.notifications.upsertPreference({
      userId,
      alertsEnabled: true,
      starIndexAlertEnabled: true,
      locationStarIndexAlertEnabled: true,
      starIndexAlertThreshold: normalizeStarIndexAlertThreshold(90),
      alertSpotId: null,
    });
  }

  async upsertPreference(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    const current = await this.getPreference(userId);
    return this.notifications.upsertPreference({
      userId,
      alertsEnabled: dto.alertsEnabled ?? current.alertsEnabled,
      starIndexAlertEnabled:
        dto.starIndexAlertEnabled ?? current.starIndexAlertEnabled,
      locationStarIndexAlertEnabled:
        dto.locationStarIndexAlertEnabled ?? current.locationStarIndexAlertEnabled,
      starIndexAlertThreshold:
        dto.starIndexAlertThreshold !== undefined
          ? normalizeStarIndexAlertThreshold(dto.starIndexAlertThreshold)
          : current.starIndexAlertThreshold,
      alertSpotId:
        dto.alertSpotId !== undefined ? dto.alertSpotId : current.alertSpotId,
    });
  }

  /** 개발용: 본인 등록 활성 토큰으로 FCM 1통(또는 기기별) */
  async sendTestPush(
    userId: string,
    dto: NotificationTestSendDto,
  ): Promise<{ targets: number; results: Array<{ tokenSuffix: string; messageId?: string; error?: string }> }> {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const forced = this.config.get<string>('FCM_TEST_SEND_ENABLED') === 'true';
    const allowed = forced || nodeEnv !== 'production';
    if (!allowed) {
      throw new ForbiddenException('이 기능은 사용할 수 없습니다.');
    }
    if (!this.fcm.isReady()) {
      throw new ServiceUnavailableException(
        '푸시 알림 서비스를 일시적으로 사용할 수 없습니다.',
      );
    }

    const tokens = await this.notifications.findActiveTokensByUserId(userId);
    if (tokens.length === 0) {
      throw new ServiceUnavailableException(
        '등록된 알림 기기가 없습니다. 앱에서 알림을 다시 켜 주세요.',
      );
    }

    const title = dto.title ?? 'StarChaser 테스트';
    const body = dto.body ?? 'FCM 실발송 검증 알림입니다.';

    const results: Array<{ tokenSuffix: string; messageId?: string; error?: string }> = [];
    let historyRecorded = false;
    for (const row of tokens) {
      const tokenSuffix =
        row.fcmToken.length > 12 ? `…${row.fcmToken.slice(-12)}` : row.fcmToken;
      try {
        const messageId = await this.fcm.sendToToken(row.fcmToken, { title, body });
        results.push({ tokenSuffix, messageId });
        if (!historyRecorded) {
          await this.notifications.recordNotificationHistory({
            userId,
            type: 'test',
            title,
            body,
          });
          historyRecorded = true;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ tokenSuffix, error: message });
      }
    }

    return { targets: tokens.length, results };
  }

  async getHistory(
    userId: string,
    options: { limit?: number; before?: string } = {},
  ): Promise<NotificationHistoryResponseDto> {
    const pageSize = Math.min(50, Math.max(1, options.limit ?? 20));
    const before = this.parseHistoryBefore(options.before);

    const [rows, unreadCount] = await Promise.all([
      this.notifications.listNotificationHistory({
        userId,
        limit: pageSize + 1,
        before,
      }),
      this.notifications.countUnreadNotificationHistory(userId),
    ]);

    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;

    return {
      items: page.map((row) => this.toHistoryDto(row)),
      unreadCount,
      hasMore,
    };
  }

  private parseHistoryBefore(raw?: string): Date | undefined {
    const trimmed = raw?.trim();
    if (!trimmed) return undefined;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(
        'before는 ISO 8601 시각(예: 2026-06-08T12:00:00.000Z)이어야 합니다.',
      );
    }
    return d;
  }

  async markAllHistoryRead(userId: string): Promise<{ ok: true }> {
    await this.notifications.markAllNotificationHistoryRead(userId);
    return { ok: true };
  }

  /** 위치한 곳 알림 스케줄용 — 앱에서 보고한 마지막 GPS */
  async reportObserverLocation(
    userId: string,
    dto: ReportObserverLocationDto,
  ): Promise<{ ok: true }> {
    await this.getPreference(userId);
    await this.notifications.upsertLastObserverLocation({
      userId,
      lat: dto.lat,
      lng: dto.lng,
      placeLabel: dto.placeLabel,
    });
    return { ok: true };
  }

  async recordPushHistory(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<void> {
    await this.notifications.recordNotificationHistory(params);
  }

  private toHistoryDto(
    row: Awaited<
      ReturnType<NotificationRepository['listNotificationHistory']>
    >[number],
  ): NotificationHistoryItemDto {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
