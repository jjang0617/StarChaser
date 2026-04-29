import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationPreference,
  type NotificationRepository,
} from '../common/interfaces/notification.repository';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpsertNotificationTokenDto } from './dto/upsert-notification-token.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
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
      astronomyEventAlertEnabled: true,
      top5AlertEnabled: true,
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
      astronomyEventAlertEnabled:
        dto.astronomyEventAlertEnabled ?? current.astronomyEventAlertEnabled,
      top5AlertEnabled: dto.top5AlertEnabled ?? current.top5AlertEnabled,
    });
  }
}
