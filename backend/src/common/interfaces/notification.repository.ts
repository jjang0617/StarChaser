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
    astronomyEventAlertEnabled: boolean;
    top5AlertEnabled: boolean;
    alertSpotId: string | null;
  }): Promise<NotificationPreference>;

  /** 실발송 테스트 등: 활성 토큰만 */
  findActiveTokensByUserId(userId: string): Promise<NotificationToken[]>;

  /** 주간 TOP5 등 알림: 알림·TOP5 허용 + 안드로이드 활성 토큰 행 */
  findAndroidRecipientsTop5Enabled(): Promise<
    Array<{ userId: string; fcmToken: string }>
  >;

  /** Star-Index 임계 알림: 알림·Star-Index ON + 기준 명소 지정 + 안드로이드 토큰 */
  findAndroidRecipientsStarIndexThreshold(): Promise<
    Array<{ userId: string; fcmToken: string; alertSpotId: string }>
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

  /** 천체 이벤트 알림: 알림·하늘 이벤트 ON + 안드로이드 활성 토큰 */
  findAndroidRecipientsAstronomyEventsEnabled(): Promise<
    Array<{ userId: string; fcmToken: string }>
  >;

  hasAstroEventPushSent(params: {
    userId: string;
    eventId: string;
  }): Promise<boolean>;

  recordAstroEventPushSent(params: {
    userId: string;
    eventId: string;
  }): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = 'NOTIFICATION_REPOSITORY';
