import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  NotificationPreference,
  NotificationRepository,
  NotificationToken,
} from '../common/interfaces/notification.repository';
import { NotificationPreferenceEntity } from './notification-preference.entity';
import { NotificationTokenEntity } from './notification-token.entity';
import { StarIndexPushSentEntity } from './star-index-push-sent.entity';
import { AstroEventPushSentEntity } from './astro-event-push-sent.entity';

@Injectable()
export class TypeOrmNotificationRepository implements NotificationRepository {
  constructor(
    @InjectRepository(NotificationTokenEntity)
    private readonly tokens: Repository<NotificationTokenEntity>,
    @InjectRepository(NotificationPreferenceEntity)
    private readonly prefs: Repository<NotificationPreferenceEntity>,
    @InjectRepository(StarIndexPushSentEntity)
    private readonly pushSent: Repository<StarIndexPushSentEntity>,
    @InjectRepository(AstroEventPushSentEntity)
    private readonly astroSent: Repository<AstroEventPushSentEntity>,
  ) {}

  async upsertToken(params: {
    userId: string;
    fcmToken: string;
    platform: 'ios' | 'android' | 'web';
  }): Promise<NotificationToken> {
    const existing = await this.tokens.findOne({
      where: { fcmToken: params.fcmToken },
    });

    if (!existing) {
      const created = this.tokens.create({
        userId: params.userId,
        fcmToken: params.fcmToken,
        platform: params.platform,
        isActive: true,
      });
      const saved = await this.tokens.save(created);
      return saved;
    }

    existing.userId = params.userId;
    existing.platform = params.platform;
    existing.isActive = true;
    const saved = await this.tokens.save(existing);
    return saved;
  }

  async findActiveTokensByUserId(userId: string): Promise<NotificationToken[]> {
    return this.tokens.find({
      where: { userId, isActive: true },
      order: { updatedAt: 'DESC' },
    });
  }

  async deactivateToken(params: { userId: string; fcmToken: string }): Promise<void> {
    await this.tokens
      .createQueryBuilder()
      .update(NotificationTokenEntity)
      .set({ isActive: false })
      .where('user_id = :userId', { userId: params.userId })
      .andWhere('fcm_token = :fcmToken', { fcmToken: params.fcmToken })
      .execute();
  }

  async getPreferenceByUserId(userId: string): Promise<NotificationPreference | null> {
    const pref = await this.prefs.findOne({ where: { userId } });
    return pref ?? null;
  }

  async upsertPreference(params: {
    userId: string;
    alertsEnabled: boolean;
    starIndexAlertEnabled: boolean;
    astronomyEventAlertEnabled: boolean;
    top5AlertEnabled: boolean;
    alertSpotId: string | null;
  }): Promise<NotificationPreference> {
    const existing = await this.prefs.findOne({ where: { userId: params.userId } });
    if (!existing) {
      const created = this.prefs.create({
        userId: params.userId,
        alertsEnabled: params.alertsEnabled,
        starIndexAlertEnabled: params.starIndexAlertEnabled,
        astronomyEventAlertEnabled: params.astronomyEventAlertEnabled,
        top5AlertEnabled: params.top5AlertEnabled,
        alertSpotId: params.alertSpotId,
      });
      return this.prefs.save(created);
    }

    existing.alertsEnabled = params.alertsEnabled;
    existing.starIndexAlertEnabled = params.starIndexAlertEnabled;
    existing.astronomyEventAlertEnabled = params.astronomyEventAlertEnabled;
    existing.top5AlertEnabled = params.top5AlertEnabled;
    existing.alertSpotId = params.alertSpotId;
    return this.prefs.save(existing);
  }

  async findAndroidRecipientsTop5Enabled(): Promise<
    Array<{ userId: string; fcmToken: string }>
  > {
    const raw = await this.tokens
      .createQueryBuilder('t')
      .innerJoin(
        NotificationPreferenceEntity,
        'p',
        'p.userId = t.userId AND p.alertsEnabled = true AND p.top5AlertEnabled = true',
      )
      .where('t.isActive = :active', { active: true })
      .andWhere('t.platform = :plat', { plat: 'android' })
      .select('t.userId', 'userId')
      .addSelect('t.fcmToken', 'fcmToken')
      .getRawMany<
        Record<string, string | undefined> & {
          userId?: string;
          fcmToken?: string;
        }
      >();
    return raw.map((r) => ({
      userId: String(r.userId ?? r.userid ?? ''),
      fcmToken: String(r.fcmToken ?? r.fcmtoken ?? ''),
    })).filter((r) => r.userId.length > 0 && r.fcmToken.length > 0);
  }

  async findAndroidRecipientsStarIndexThreshold(): Promise<
    Array<{ userId: string; fcmToken: string; alertSpotId: string }>
  > {
    const raw = await this.tokens
      .createQueryBuilder('t')
      .innerJoin(
        NotificationPreferenceEntity,
        'p',
        'p.userId = t.userId AND p.alertsEnabled = true AND p.starIndexAlertEnabled = true AND p.alertSpotId IS NOT NULL',
      )
      .where('t.isActive = :active', { active: true })
      .andWhere('t.platform = :plat', { plat: 'android' })
      .select('t.userId', 'userId')
      .addSelect('t.fcmToken', 'fcmToken')
      .addSelect('p.alertSpotId', 'alertSpotId')
      .getRawMany<
        Record<string, string | undefined> & {
          userId?: string;
          fcmToken?: string;
          alertSpotId?: string;
        }
      >();
    return raw
      .map((r) => ({
        userId: String(r.userId ?? r.userid ?? ''),
        fcmToken: String(r.fcmToken ?? r.fcmtoken ?? ''),
        alertSpotId: String(r.alertSpotId ?? r.alertspotid ?? ''),
      }))
      .filter(
        (r) =>
          r.userId.length > 0 &&
          r.fcmToken.length > 0 &&
          r.alertSpotId.length > 0,
      );
  }

  async hasStarIndexPushSentForKstDay(params: {
    userId: string;
    spotId: string;
    dayKstYmd: string;
  }): Promise<boolean> {
    const n = await this.pushSent.count({
      where: {
        userId: params.userId,
        spotId: params.spotId,
        sentDayKst: params.dayKstYmd,
      },
    });
    return n > 0;
  }

  async recordStarIndexPushSent(params: {
    userId: string;
    spotId: string;
    dayKstYmd: string;
  }): Promise<void> {
    const row = this.pushSent.create({
      userId: params.userId,
      spotId: params.spotId,
      sentDayKst: params.dayKstYmd,
    });
    try {
      await this.pushSent.save(row);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === '23505') return;
      throw e;
    }
  }

  async findAndroidRecipientsAstronomyEventsEnabled(): Promise<
    Array<{ userId: string; fcmToken: string }>
  > {
    const raw = await this.tokens
      .createQueryBuilder('t')
      .innerJoin(
        NotificationPreferenceEntity,
        'p',
        'p.userId = t.userId AND p.alertsEnabled = true AND p.astronomyEventAlertEnabled = true',
      )
      .where('t.isActive = :active', { active: true })
      .andWhere('t.platform = :plat', { plat: 'android' })
      .select('t.userId', 'userId')
      .addSelect('t.fcmToken', 'fcmToken')
      .getRawMany<
        Record<string, string | undefined> & {
          userId?: string;
          fcmToken?: string;
        }
      >();
    return raw
      .map((r) => ({
        userId: String(r.userId ?? r.userid ?? ''),
        fcmToken: String(r.fcmToken ?? r.fcmtoken ?? ''),
      }))
      .filter((r) => r.userId.length > 0 && r.fcmToken.length > 0);
  }

  async hasAstroEventPushSent(params: {
    userId: string;
    eventId: string;
  }): Promise<boolean> {
    const n = await this.astroSent.count({
      where: { userId: params.userId, eventId: params.eventId },
    });
    return n > 0;
  }

  async recordAstroEventPushSent(params: {
    userId: string;
    eventId: string;
  }): Promise<void> {
    const row = this.astroSent.create({
      userId: params.userId,
      eventId: params.eventId,
    });
    try {
      await this.astroSent.save(row);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === '23505') return;
      throw e;
    }
  }
}
