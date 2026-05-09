export type NotificationPlatform = 'ios' | 'android' | 'web';

export interface NotificationToken {
  id: string;
  userId: string;
  fcmToken: string;
  platform: NotificationPlatform;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  userId: string;
  alertsEnabled: boolean;
  starIndexAlertEnabled: boolean;
  astronomyEventAlertEnabled: boolean;
  top5AlertEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRepository {
  upsertToken(params: {
    userId: string;
    fcmToken: string;
    platform: NotificationPlatform;
  }): Promise<NotificationToken>;
  deactivateToken(params: { userId: string; fcmToken: string }): Promise<void>;
  getPreferenceByUserId(userId: string): Promise<NotificationPreference | null>;
  upsertPreference(params: {
    userId: string;
    alertsEnabled: boolean;
    starIndexAlertEnabled: boolean;
    astronomyEventAlertEnabled: boolean;
    top5AlertEnabled: boolean;
  }): Promise<NotificationPreference>;

  /** 실발송 테스트 등: 활성 토큰만 */
  findActiveTokensByUserId(userId: string): Promise<NotificationToken[]>;
}

export const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';
