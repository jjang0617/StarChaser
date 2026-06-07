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

export type StarIndexAlertThreshold = 80 | 85 | 90 | 95;

export interface NotificationPreference {
  userId: string;
  alertsEnabled: boolean;
  starIndexAlertEnabled: boolean;
  locationStarIndexAlertEnabled: boolean;
  starIndexAlertThreshold: StarIndexAlertThreshold;
  /** Star-Index 임계 알림용 기준 명소 */
  alertSpotId: string | null;
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
    locationStarIndexAlertEnabled: boolean;
    starIndexAlertThreshold: StarIndexAlertThreshold;
    alertSpotId: string | null;
  }): Promise<NotificationPreference>;

  /** 실발송 테스트 등: 활성 토큰만 */
  findActiveTokensByUserId(userId: string): Promise<NotificationToken[]>;

  /** Star-Index 임계 알림: 알림·Star-Index ON + 기준 명소 지정 + 안드로이드 토큰 */
  findAndroidRecipientsStarIndexThreshold(): Promise<
    Array<{
      userId: string;
      fcmToken: string;
      alertSpotId: string;
      starIndexAlertThreshold: StarIndexAlertThreshold;
    }>
  >;

  hasStarIndexPushSentForKstDay(params: {
    userId: string;
    spotId: string;
    dayKstYmd: string;
  }): Promise<boolean>;

  recordStarIndexPushSent(params: {
    userId: string;
    spotId: string;
    dayKstYmd: string;
  }): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';
