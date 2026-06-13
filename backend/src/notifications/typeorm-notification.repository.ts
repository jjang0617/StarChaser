import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import type {
  NotificationHistoryItem,
  NotificationPreference,
  NotificationRepository,
  NotificationToken,
} from '../common/interfaces/notification.repository';
import { NotificationHistoryEntity } from './notification-history.entity';
import { LocationStarIndexPushSentEntity } from './location-star-index-push-sent.entity';
import { NotificationPreferenceEntity } from './notification-preference.entity';
import { normalizeStarIndexAlertThreshold } from './star-index-alert-threshold';
import { NotificationTokenEntity } from './notification-token.entity';
import { StarIndexPushSentEntity } from './star-index-push-sent.entity';

@Injectable()
export class TypeOrmNotificationRepository implements NotificationRepository {
  constructor(
    @InjectRepository(NotificationTokenEntity)
    private readonly tokens: Repository<NotificationTokenEntity>,
    @InjectRepository(NotificationPreferenceEntity)
    private readonly prefs: Repository<NotificationPreferenceEntity>,
    @InjectRepository(StarIndexPushSentEntity)
    private readonly pushSent: Repository<StarIndexPushSentEntity>,
    @InjectRepository(NotificationHistoryEntity)
    private readonly history: Repository<NotificationHistoryEntity>,
    @InjectRepository(LocationStarIndexPushSentEntity)
    private readonly locationPushSent: Repository<LocationStarIndexPushSentEntity>,
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

  private toPreference(entity: NotificationPreferenceEntity): NotificationPreference {
    return {
      userId: entity.userId,
      alertsEnabled: entity.alertsEnabled,
      starIndexAlertEnabled: entity.starIndexAlertEnabled,
      locationStarIndexAlertEnabled: entity.locationStarIndexAlertEnabled,
      starIndexAlertThreshold: normalizeStarIndexAlertThreshold(
        entity.starIndexAlertThreshold,
      ),
      alertSpotId: entity.alertSpotId,
      lastObserverLat: entity.lastObserverLat,
      lastObserverLng: entity.lastObserverLng,
      lastObserverPlaceLabel: entity.lastObserverPlaceLabel,
      lastObserverAt: entity.lastObserverAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  async getPreferenceByUserId(userId: string): Promise<NotificationPreference | null> {
    const pref = await this.prefs.findOne({ where: { userId } });
    return pref ? this.toPreference(pref) : null;
  }

  async upsertPreference(params: {
    userId: string;
    alertsEnabled: boolean;
    starIndexAlertEnabled: boolean;
    locationStarIndexAlertEnabled: boolean;
    starIndexAlertThreshold: NotificationPreference['starIndexAlertThreshold'];
    alertSpotId: string | null;
  }): Promise<NotificationPreference> {
    const threshold = normalizeStarIndexAlertThreshold(params.starIndexAlertThreshold);
    const existing = await this.prefs.findOne({ where: { userId: params.userId } });
    if (!existing) {
      const created = this.prefs.create({
        userId: params.userId,
        alertsEnabled: params.alertsEnabled,
        starIndexAlertEnabled: params.starIndexAlertEnabled,
        locationStarIndexAlertEnabled: params.locationStarIndexAlertEnabled,
        starIndexAlertThreshold: threshold,
        alertSpotId: params.alertSpotId,
      });
      const saved = await this.prefs.save(created);
      return this.toPreference(saved);
    }

    existing.alertsEnabled = params.alertsEnabled;
    existing.starIndexAlertEnabled = params.starIndexAlertEnabled;
    existing.locationStarIndexAlertEnabled = params.locationStarIndexAlertEnabled;
    existing.starIndexAlertThreshold = threshold;
    existing.alertSpotId = params.alertSpotId;
    const saved = await this.prefs.save(existing);
    return this.toPreference(saved);
  }

  async upsertLastObserverLocation(params: {
    userId: string;
    lat: number;
    lng: number;
    placeLabel?: string | null;
  }): Promise<void> {
    const existing = await this.prefs.findOne({ where: { userId: params.userId } });
    const label =
      params.placeLabel !== undefined
        ? params.placeLabel?.trim() || null
        : undefined;

    if (!existing) {
      const threshold = normalizeStarIndexAlertThreshold(90);
      const created = this.prefs.create({
        userId: params.userId,
        alertsEnabled: true,
        starIndexAlertEnabled: true,
        locationStarIndexAlertEnabled: true,
        starIndexAlertThreshold: threshold,
        alertSpotId: null,
        lastObserverLat: params.lat,
        lastObserverLng: params.lng,
        lastObserverPlaceLabel: label ?? null,
        lastObserverAt: new Date(),
      });
      await this.prefs.save(created);
      return;
    }

    existing.lastObserverLat = params.lat;
    existing.lastObserverLng = params.lng;
    existing.lastObserverAt = new Date();
    if (label !== undefined) {
      existing.lastObserverPlaceLabel = label;
    }
    await this.prefs.save(existing);
  }

  async findAndroidRecipientsLocationStarIndexThreshold(params: {
    maxObserverAgeDays: number;
  }): Promise<
    Array<{
      userId: string;
      fcmToken: string;
      starIndexAlertThreshold: NotificationPreference['starIndexAlertThreshold'];
      lastObserverLat: number;
      lastObserverLng: number;
      lastObserverPlaceLabel: string | null;
    }>
  > {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - params.maxObserverAgeDays);

    const raw = await this.tokens
      .createQueryBuilder('t')
      .innerJoin(
        NotificationPreferenceEntity,
        'p',
        'p.user_id = t.user_id',
      )
      .where('t.is_active = :active', { active: true })
      .andWhere('t.platform = :plat', { plat: 'android' })
      .andWhere('p.alerts_enabled = true')
      .andWhere('p.location_star_index_alert_enabled = true')
      .andWhere('p.last_observer_lat IS NOT NULL')
      .andWhere('p.last_observer_lng IS NOT NULL')
      .andWhere('p.last_observer_at >= :cutoff', { cutoff })
      .select('t.userId', 'userId')
      .addSelect('t.fcmToken', 'fcmToken')
      .addSelect('p.starIndexAlertThreshold', 'starIndexAlertThreshold')
      .addSelect('p.lastObserverLat', 'lastObserverLat')
      .addSelect('p.lastObserverLng', 'lastObserverLng')
      .addSelect('p.lastObserverPlaceLabel', 'lastObserverPlaceLabel')
      .getRawMany<
        Record<string, string | number | undefined> & {
          userId?: string;
          fcmToken?: string;
          starIndexAlertThreshold?: number | string;
          lastObserverLat?: number | string;
          lastObserverLng?: number | string;
          lastObserverPlaceLabel?: string | null;
        }
      >();

    return raw
      .map((r) => {
        const lat = Number(r.lastObserverLat ?? r.lastobserverlat);
        const lng = Number(r.lastObserverLng ?? r.lastobserverlng);
        return {
          userId: String(r.userId ?? r.userid ?? ''),
          fcmToken: String(r.fcmToken ?? r.fcmtoken ?? ''),
          starIndexAlertThreshold: normalizeStarIndexAlertThreshold(
            r.starIndexAlertThreshold ?? r.starindexalertthreshold,
          ),
          lastObserverLat: lat,
          lastObserverLng: lng,
          lastObserverPlaceLabel:
            (r.lastObserverPlaceLabel ?? r.lastobserverplacelabel ?? null) as
              | string
              | null,
        };
      })
      .filter(
        (r) =>
          r.userId.length > 0 &&
          r.fcmToken.length > 0 &&
          Number.isFinite(r.lastObserverLat) &&
          Number.isFinite(r.lastObserverLng),
      );
  }

  async findAndroidRecipientsStarIndexThreshold(): Promise<
    Array<{
      userId: string;
      fcmToken: string;
      alertSpotId: string;
      starIndexAlertThreshold: NotificationPreference['starIndexAlertThreshold'];
    }>
  > {
    const raw = await this.tokens
      .createQueryBuilder('t')
      .innerJoin(
        NotificationPreferenceEntity,
        'p',
        'p.user_id = t.user_id AND p.alerts_enabled = true AND p.star_index_alert_enabled = true AND p.alert_spot_id IS NOT NULL',
      )
      .where('t.is_active = :active', { active: true })
      .andWhere('t.platform = :plat', { plat: 'android' })
      .select('t.userId', 'userId')
      .addSelect('t.fcmToken', 'fcmToken')
      .addSelect('p.alertSpotId', 'alertSpotId')
      .addSelect('p.starIndexAlertThreshold', 'starIndexAlertThreshold')
      .getRawMany<
        Record<string, string | number | undefined> & {
          userId?: string;
          fcmToken?: string;
          alertSpotId?: string;
          starIndexAlertThreshold?: number | string;
        }
      >();
    return raw
      .map((r) => ({
        userId: String(r.userId ?? r.userid ?? ''),
        fcmToken: String(r.fcmToken ?? r.fcmtoken ?? ''),
        alertSpotId: String(r.alertSpotId ?? r.alertspotid ?? ''),
        starIndexAlertThreshold: normalizeStarIndexAlertThreshold(
          r.starIndexAlertThreshold ?? r.starindexalertthreshold,
        ),
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

  async hasLocationStarIndexPushSentForKstDay(params: {
    userId: string;
    dayKstYmd: string;
  }): Promise<boolean> {
    const n = await this.locationPushSent.count({
      where: {
        userId: params.userId,
        sentDayKst: params.dayKstYmd,
      },
    });
    return n > 0;
  }

  async recordLocationStarIndexPushSent(params: {
    userId: string;
    dayKstYmd: string;
  }): Promise<void> {
    const row = this.locationPushSent.create({
      userId: params.userId,
      sentDayKst: params.dayKstYmd,
    });
    try {
      await this.locationPushSent.save(row);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === '23505') return;
      throw e;
    }
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

  private toHistory(entity: NotificationHistoryEntity): NotificationHistoryItem {
    return {
      id: entity.id,
      userId: entity.userId,
      type: entity.type,
      title: entity.title,
      body: entity.body,
      data: entity.data,
      readAt: entity.readAt,
      createdAt: entity.createdAt,
    };
  }

  async recordNotificationHistory(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, string> | null;
  }): Promise<NotificationHistoryItem> {
    const row = this.history.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      data: params.data ?? null,
    });
    const saved = await this.history.save(row);
    return this.toHistory(saved);
  }

  async listNotificationHistory(params: {
    userId: string;
    limit: number;
    before?: Date;
  }): Promise<NotificationHistoryItem[]> {
    const rows = await this.history.find({
      where: {
        userId: params.userId,
        ...(params.before ? { createdAt: LessThan(params.before) } : {}),
      },
      order: { createdAt: 'DESC' },
      take: params.limit,
    });
    return rows.map((r) => this.toHistory(r));
  }

  async countUnreadNotificationHistory(userId: string): Promise<number> {
    return this.history.count({
      where: { userId, readAt: IsNull() },
    });
  }

  async markAllNotificationHistoryRead(userId: string): Promise<void> {
    await this.history
      .createQueryBuilder()
      .update(NotificationHistoryEntity)
      .set({ readAt: () => 'now()' })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();
  }
}
