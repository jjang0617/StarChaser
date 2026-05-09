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

  /** 주간 TOP5 등 알림: 알림·TOP5 허용 + 안드로이드 활성 토큰 행 */
  findAndroidRecipientsTop5Enabled(): Promise<
    Array<{ userId: string; fcmToken: string }>
  >;
}

export const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';
