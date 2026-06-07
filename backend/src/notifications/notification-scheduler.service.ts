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
   * 매시 정각 15분 KST — ME 기준 명소(alertSpotId) Star-Index 임계 이상이면 1일 1회 푸시.
   * TODO: MAIN 위치한 곳(GPS·역지오) 알림 채널은 별도 스케줄·설정으로 분리.
   */
  @Cron('15 * * * *', { timeZone: 'Asia/Seoul' })
  async sendStarIndexThresholdDigest(): Promise<void> {
    this.logger.log('[Star-Index push] cron tick');
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

    let recipients;
    try {
      recipients =
        await this.notifications.findAndroidRecipientsStarIndexThreshold();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[Star-Index push] 수신자 조회 실패: ${msg}`);
      return;
    }

    if (!recipients.length) {
      this.logger.log('[Star-Index push] 조건에 맞는 안드로이드 토큰 없음');
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
          `[Star-Index push] 점수 계산 실패 spot=${alertSpotId.slice(0, 8)}… ${msg}`,
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

      try {
        await this.fcm.sendToToken(fcmToken, { title, body, data });
        await this.notifications.recordStarIndexPushSent({
          userId,
          spotId: alertSpotId,
          dayKstYmd: dayKst,
        });
        ok++;
      } catch (err: unknown) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('not a valid FCM registration token') ||
          message.includes('registration-token-not-registered')
        ) {
          await this.notifications.deactivateToken({ userId, fcmToken });
          this.logger.warn(
            `[Star-Index push] 무효 토큰 비활성화 user=${userId.slice(0, 8)}…`,
          );
        } else {
          this.logger.warn(
            `[Star-Index push] 발송 실패 user=${userId.slice(0, 8)}… ${message}`,
          );
        }
      }
    }

    this.logger.log(
      `[Star-Index push] 완료 dayKst=${dayKst} 대상=${recipients.length} 성공=${ok} 실패=${failed} 건너뜀=${skipped}`,
    );
  }
}
