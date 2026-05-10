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
import { WeeklyTop5Service } from '../weekly-top5/weekly-top5.service';
import { AstronomyEventsCatalogService } from '../astronomy-events/astronomy-events-catalog.service';

/**
 * 사용자 알림 설정·FCM과 연동된 예약 발송.
 * 주간 TOP5 집계(Cron 월 07:00) 직후에 맞추어 월요일 07:05 KST에 실행.
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
    private readonly weeklyTop5: WeeklyTop5Service,
    private readonly starIndex: StarIndexService,
    @Inject(SPOT_REPOSITORY)
    private readonly spots: SpotRepository,
    private readonly astronomyCatalog: AstronomyEventsCatalogService,
  ) {}

  @Cron('5 7 * * 1', { timeZone: 'Asia/Seoul' })
  async sendWeeklyTop5Digest(): Promise<void> {
    // 방법 B(분당 실행) 검증 시 터미널에 찍히는지 확인용. 운영·월요일만 쓸 땐 로그를 줄이세요.
    this.logger.log('[TOP5 push] cron tick');
    const raw = this.envStr('FCM_SCHEDULED_TOP5_PUSH_ENABLED');
    const enabled = String(raw ?? '').trim().toLowerCase() === 'true';
    if (!enabled) {
      this.logger.warn(
        `[TOP5 push] 건너뜀: FCM_SCHEDULED_TOP5_PUSH_ENABLED=${JSON.stringify(raw)} (문자열 true 필요, 서버 재시작 후 확인)`,
      );
      return;
    }
    if (!this.fcm.isReady()) {
      this.logger.warn(
        '[TOP5 push] FCM 미초기화 — FIREBASE_* 환경변수를 확인하세요.',
      );
      return;
    }

    let items;
    try {
      items = await this.weeklyTop5.getWeekly();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`[TOP5 push] 주간 목록 조회 실패: ${msg}`);
      return;
    }

    if (!items.length) {
      this.logger.log('[TOP5 push] 집계 데이터 없음 — 건너뜀');
      return;
    }

    const weekStart = items[0].weekStart;
    const lead = items[0];
    const title = '이번 주 추천 명소 TOP5';
    const body =
      items.length >= 2
        ? `1위 ${lead.spotName} 외 ${items.length - 1}곳 — 앱에서 순위를 확인해 보세요.`
        : `1위 ${lead.spotName} — 앱에서 순위를 확인해 보세요.`;

    let recipients;
    try {
      recipients = await this.notifications.findAndroidRecipientsTop5Enabled();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[TOP5 push] 수신자 조회 실패: ${msg}`);
      return;
    }

    if (!recipients.length) {
      this.logger.log('[TOP5 push] 조건에 맞는 안드로이드 토큰 없음');
      return;
    }

    const data: Record<string, string> = {
      type: 'weekly_top5',
      weekStart,
    };

    let ok = 0;
    let failed = 0;
    for (const { userId, fcmToken } of recipients) {
      try {
        await this.fcm.sendToToken(fcmToken, { title, body, data });
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
            `[TOP5 push] 무효 토큰 비활성화 user=${userId.slice(0, 8)}…`,
          );
        } else {
          this.logger.warn(
            `[TOP5 push] 발송 실패 user=${userId.slice(0, 8)}… ${message}`,
          );
        }
      }
    }

    this.logger.log(
      `[TOP5 push] 완료 weekStart=${weekStart} 대상=${recipients.length} 성공=${ok} 실패=${failed}`,
    );
  }

  /** 매시 정각 15분 KST — 기준 명소 Star-Index가 임계 이상이면 1일 1회 푸시 */
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

    const thresholdRaw = this.envStr('STAR_INDEX_ALERT_THRESHOLD');
    const threshold = Number.parseInt(String(thresholdRaw ?? '70').trim(), 10);
    const thresholdScore = Number.isFinite(threshold) ? threshold : 70;

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

    for (const { userId, fcmToken, alertSpotId } of recipients) {
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
      const body = `${spot.name}의 Star-Index가 ${Math.round(score)}입니다. 조건을 충족했어요.`;
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
      `[Star-Index push] 완료 dayKst=${dayKst} 임계=${thresholdScore} 대상=${recipients.length} 성공=${ok} 실패=${failed} 건너뜀=${skipped}`,
    );
  }

  /**
   * 천체 이벤트(정적 JSON 윈도) — 매시 20분 KST.
   * 이벤트·사용자별 1회(astro_event_push_sent).
   */
  @Cron('20 * * * *', { timeZone: 'Asia/Seoul' })
  async sendAstronomyEventAlerts(): Promise<void> {
    this.logger.log('[Astro event push] cron tick');
    const raw = this.envStr('FCM_SCHEDULED_ASTRO_EVENT_PUSH_ENABLED');
    const enabled = String(raw ?? '').trim().toLowerCase() === 'true';
    if (!enabled) {
      this.logger.warn(
        `[Astro event push] 건너뜀: FCM_SCHEDULED_ASTRO_EVENT_PUSH_ENABLED=${JSON.stringify(raw)}`,
      );
      return;
    }
    if (!this.fcm.isReady()) {
      this.logger.warn(
        '[Astro event push] FCM 미초기화 — FIREBASE_* 환경변수를 확인하세요.',
      );
      return;
    }

    const events = this.astronomyCatalog.getActiveEvents(new Date());
    if (!events.length) {
      this.logger.log('[Astro event push] 활성 이벤트(윈도) 없음');
      return;
    }
    this.logger.log(
      `[Astro event push] 활성 윈도: ${events.map((e) => `${e.id}(${e.type})`).join(', ')}`,
    );

    let recipients;
    try {
      recipients =
        await this.notifications.findAndroidRecipientsAstronomyEventsEnabled();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[Astro event push] 수신자 조회 실패: ${msg}`);
      return;
    }

    if (!recipients.length) {
      this.logger.log('[Astro event push] 조건에 맞는 안드로이드 토큰 없음');
      return;
    }

    let ok = 0;
    let failed = 0;
    let skipped = 0;

    for (const event of events) {
      for (const { userId, fcmToken } of recipients) {
        const already = await this.notifications.hasAstroEventPushSent({
          userId,
          eventId: event.id,
        });
        if (already) {
          skipped++;
          continue;
        }

        const data: Record<string, string> = {
          type: 'astronomy_event',
          eventId: event.id,
          eventType: event.type,
        };

        try {
          await this.fcm.sendToToken(fcmToken, {
            title: event.title,
            body: event.body,
            data,
          });
          await this.notifications.recordAstroEventPushSent({
            userId,
            eventId: event.id,
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
              `[Astro event push] 무효 토큰 비활성화 user=${userId.slice(0, 8)}…`,
            );
          } else {
            this.logger.warn(
              `[Astro event push] 발송 실패 event=${event.id} user=${userId.slice(0, 8)}… ${message}`,
            );
          }
        }
      }
    }

    this.logger.log(
      `[Astro event push] 완료 이벤트=${events.length} 수신행=${recipients.length} 성공=${ok} 실패=${failed} 건너뜀=${skipped}`,
    );
  }
}
