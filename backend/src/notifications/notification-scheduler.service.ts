import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from '../common/interfaces/notification.repository';
import { FcmPushService } from './fcm-push.service';
import { WeeklyTop5Service } from '../weekly-top5/weekly-top5.service';

/**
 * 사용자 알림 설정·FCM과 연동된 예약 발송.
 * 주간 TOP5 집계(Cron 월 07:00) 직후에 맞추어 월요일 07:05 KST에 실행.
 */
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly fcm: FcmPushService,
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
    private readonly weeklyTop5: WeeklyTop5Service,
  ) {}

  @Cron('*/1 * * * *', { timeZone: 'Asia/Seoul' })
  async sendWeeklyTop5Digest(): Promise<void> {
    // 방법 B(분당 실행) 검증 시 터미널에 찍히는지 확인용. 운영·월요일만 쓸 땐 로그를 줄이세요.
    this.logger.log('[TOP5 push] cron tick');
    const raw = this.config.get<string | undefined>('FCM_SCHEDULED_TOP5_PUSH_ENABLED');
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
}
