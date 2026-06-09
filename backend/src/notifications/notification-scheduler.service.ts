import { Inject, Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { ConfigService } from '@nestjs/config';

import {

  NOTIFICATION_REPOSITORY,

  type NotificationRepository,

} from '../common/interfaces/notification.repository';

import {

  SPOT_REPOSITORY,

  type SpotRepository,

} from '../common/interfaces/spot.repository';

import { getKstYmd } from '../common/kst-date';

import { StarIndexService } from '../star-index/star-index.service';

import { FcmPushService } from './fcm-push.service';

import { LOCATION_OBSERVER_MAX_AGE_DAYS } from './location-observer.constants';



/**

 * 사용자 알림 설정·FCM과 연동된 예약 발송.

 */

@Injectable()

export class NotificationSchedulerService {

  private readonly logger = new Logger(NotificationSchedulerService.name);



  /** process.env 우선 — load-env(override) 값이 ConfigService 내부 캐시에 가려지는 경우 방지 */

  private envStr(key: string): string | undefined {

    return process.env[key] ?? this.config.get<string | undefined>(key);

  }



  constructor(

    private readonly config: ConfigService,

    private readonly fcm: FcmPushService,

    @Inject(NOTIFICATION_REPOSITORY)

    private readonly notifications: NotificationRepository,

    private readonly starIndex: StarIndexService,

    @Inject(SPOT_REPOSITORY)

    private readonly spots: SpotRepository,

  ) {}



  /**

   * 매시 정각 15분 KST — Star-Index 임계 알림 (기준 명소 + 위치한 곳).

   */

  @Cron('15 * * * *', { timeZone: 'Asia/Seoul' })

  async runScheduledStarIndexPushes(): Promise<void> {

    const raw = this.envStr('FCM_SCHEDULED_STAR_INDEX_PUSH_ENABLED');

    const enabled = String(raw ?? '').trim().toLowerCase() === 'true';

    if (!enabled) {

      this.logger.warn(

        `[Star-Index push] 건너뜀: FCM_SCHEDULED_STAR_INDEX_PUSH_ENABLED=${JSON.stringify(raw)}`,

      );

      return;

    }

    if (!this.fcm.isReady()) {

      this.logger.warn(

        '[Star-Index push] FCM 미초기화 — FIREBASE_* 환경변수를 확인하세요.',

      );

      return;

    }



    await this.sendSpotStarIndexThresholdDigest();

    await this.sendLocationStarIndexThresholdDigest();

  }



  /** ME 기준 명소(alertSpotId) Star-Index 임계 이상이면 1일 1회 푸시 */

  private async sendSpotStarIndexThresholdDigest(): Promise<void> {

    this.logger.log('[Star-Index push:spot] cron tick');



    let recipients;

    try {

      recipients =

        await this.notifications.findAndroidRecipientsStarIndexThreshold();

    } catch (e) {

      const msg = e instanceof Error ? e.message : String(e);

      this.logger.error(`[Star-Index push:spot] 수신자 조회 실패: ${msg}`);

      return;

    }



    if (!recipients.length) {

      this.logger.log('[Star-Index push:spot] 조건에 맞는 안드로이드 토큰 없음');

      return;

    }



    const dayKst = getKstYmd();

    let ok = 0;

    let failed = 0;

    let skipped = 0;



    for (const {

      userId,

      fcmToken,

      alertSpotId,

      starIndexAlertThreshold,

    } of recipients) {

      const thresholdScore = starIndexAlertThreshold;

      const spot = await this.spots.findById(alertSpotId);

      if (!spot) {

        skipped++;

        continue;

      }



      const already = await this.notifications.hasStarIndexPushSentForKstDay({

        userId,

        spotId: alertSpotId,

        dayKstYmd: dayKst,

      });

      if (already) {

        skipped++;

        continue;

      }



      let score: number;

      try {

        score = await this.starIndex.computeFreshScoreFromCache(spot);

      } catch (e) {

        const msg = e instanceof Error ? e.message : String(e);

        this.logger.warn(

          `[Star-Index push:spot] 점수 계산 실패 spot=${alertSpotId.slice(0, 8)}… ${msg}`,

        );

        skipped++;

        continue;

      }



      if (score < thresholdScore) {

        skipped++;

        continue;

      }



      const title = '별 보기 좋은 날 알림';

      const body = `${spot.name} Star-Index ${Math.round(score)}점 — ${thresholdScore}점 이상이라 관측하기 좋은 밤이에요.`;

      const data: Record<string, string> = {

        type: 'star_index_threshold',

        spotId: alertSpotId,

        score: String(Math.round(score)),

        dayKst,

      };



      const sent = await this.dispatchPush({

        userId,

        fcmToken,

        title,

        body,

        data,

        logTag: 'spot',

      });

      if (sent === 'ok') {

        await this.notifications.recordStarIndexPushSent({

          userId,

          spotId: alertSpotId,

          dayKstYmd: dayKst,

        });

        await this.notifications.recordNotificationHistory({

          userId,

          type: 'star_index_threshold',

          title,

          body,

          data,

        });

        ok++;

      } else if (sent === 'failed') {

        failed++;

      } else {

        skipped++;

      }

    }



    this.logger.log(

      `[Star-Index push:spot] 완료 dayKst=${dayKst} 대상=${recipients.length} 성공=${ok} 실패=${failed} 건너뜀=${skipped}`,

    );

  }



  /** 위치한 곳(GPS) Star-Index 임계 이상이면 1일 1회 푸시 */

  private async sendLocationStarIndexThresholdDigest(): Promise<void> {

    this.logger.log('[Star-Index push:location] cron tick');



    let recipients;

    try {

      recipients =

        await this.notifications.findAndroidRecipientsLocationStarIndexThreshold({

          maxObserverAgeDays: LOCATION_OBSERVER_MAX_AGE_DAYS,

        });

    } catch (e) {

      const msg = e instanceof Error ? e.message : String(e);

      this.logger.error(`[Star-Index push:location] 수신자 조회 실패: ${msg}`);

      return;

    }



    if (!recipients.length) {

      this.logger.log(

        '[Star-Index push:location] 조건에 맞는 안드로이드 토큰 없음 (위치 미보고·만료 포함)',

      );

      return;

    }



    const dayKst = getKstYmd();

    let ok = 0;

    let failed = 0;

    let skipped = 0;



    for (const {

      userId,

      fcmToken,

      starIndexAlertThreshold,

      lastObserverLat,

      lastObserverLng,

      lastObserverPlaceLabel,

    } of recipients) {

      const already = await this.notifications.hasLocationStarIndexPushSentForKstDay({

        userId,

        dayKstYmd: dayKst,

      });

      if (already) {

        skipped++;

        continue;

      }



      let score: number;

      try {

        const result = await this.starIndex.calculateForLatLngFromCache(

          lastObserverLat,

          lastObserverLng,

        );

        score = result.score;

      } catch (e) {

        const msg = e instanceof Error ? e.message : String(e);

        this.logger.warn(

          `[Star-Index push:location] 점수 계산 실패 user=${userId.slice(0, 8)}… ${msg}`,

        );

        skipped++;

        continue;

      }



      if (score < starIndexAlertThreshold) {

        skipped++;

        continue;

      }



      const place =

        lastObserverPlaceLabel?.trim() || '현재 위치';

      const title = '위치한 곳 별 보기 좋은 날 알림';

      const body = `${place} Star-Index ${Math.round(score)}점 — ${starIndexAlertThreshold}점 이상이라 관측하기 좋은 밤이에요.`;

      const data: Record<string, string> = {

        type: 'location_star_index_threshold',

        lat: String(lastObserverLat),

        lng: String(lastObserverLng),

        score: String(Math.round(score)),

        dayKst,

      };

      if (lastObserverPlaceLabel?.trim()) {

        data.placeLabel = lastObserverPlaceLabel.trim();

      }



      const sent = await this.dispatchPush({

        userId,

        fcmToken,

        title,

        body,

        data,

        logTag: 'location',

      });

      if (sent === 'ok') {

        await this.notifications.recordLocationStarIndexPushSent({

          userId,

          dayKstYmd: dayKst,

        });

        await this.notifications.recordNotificationHistory({

          userId,

          type: 'location_star_index_threshold',

          title,

          body,

          data,

        });

        ok++;

      } else if (sent === 'failed') {

        failed++;

      } else {

        skipped++;

      }

    }



    this.logger.log(

      `[Star-Index push:location] 완료 dayKst=${dayKst} 대상=${recipients.length} 성공=${ok} 실패=${failed} 건너뜀=${skipped}`,

    );

  }



  private async dispatchPush(params: {

    userId: string;

    fcmToken: string;

    title: string;

    body: string;

    data: Record<string, string>;

    logTag: string;

  }): Promise<'ok' | 'failed' | 'skipped'> {

    try {

      await this.fcm.sendToToken(params.fcmToken, {

        title: params.title,

        body: params.body,

        data: params.data,

      });

      return 'ok';

    } catch (err: unknown) {

      const message = err instanceof Error ? err.message : String(err);

      if (

        message.includes('not a valid FCM registration token') ||

        message.includes('registration-token-not-registered')

      ) {

        await this.notifications.deactivateToken({

          userId: params.userId,

          fcmToken: params.fcmToken,

        });

        this.logger.warn(

          `[Star-Index push:${params.logTag}] 무효 토큰 비활성화 user=${params.userId.slice(0, 8)}…`,

        );

        return 'skipped';

      }

      this.logger.warn(

        `[Star-Index push:${params.logTag}] 발송 실패 user=${params.userId.slice(0, 8)}… ${message}`,

      );

      return 'failed';

    }

  }

}


