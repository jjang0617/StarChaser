import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { SkyService } from '../sky/sky.service';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';

// ──────────────────────────────────────────────────────────────
// Cron 수집기 — 장성재(A) 담당
// 외부 API는 앱에서 직접 호출 금지 — 반드시 Cron → CacheService → 앱
// ──────────────────────────────────────────────────────────────

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
    private readonly skyService: SkyService,
    @Inject(SPOT_REPOSITORY) private readonly spots: SpotRepository,
  ) {}

  private latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
    const RE = 6371.00877;
    const GRID = 5.0;
    const SLAT1 = 30.0;
    const SLAT2 = 60.0;
    const OLON = 126.0;
    const OLAT = 38.0;
    const XO = 43;
    const YO = 136;

    const DEGRAD = Math.PI / 180.0;

    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;

    let sn =
      Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
      Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;

    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = (re * sf) / Math.pow(ro, sn);

    const ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
    const raVal = (re * sf) / Math.pow(ra, sn);

    let theta = lng * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;

    const nx = Math.floor(raVal * Math.sin(theta) + XO + 0.5);
    const ny = Math.floor(ro - raVal * Math.cos(theta) + YO + 0.5);

    return { nx, ny };
  }

  private pickForecast(
    items: Array<{ category?: string; fcstValue?: string }>,
  ): {
    cloud: number;
    humidity: number;
    windSpeed: number;
    visibility: number;
    temperature: number;
    pop: number;
  } {
    const findValue = (category: string, fallback: number): number => {
      const raw = items.find((v) => v.category === category)?.fcstValue;
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    return {
      cloud: findValue('SKY', 5) * 25,
      humidity: findValue('REH', 70),
      windSpeed: findValue('WSD', 2),
      visibility: findValue('VVV', 10),
      temperature: findValue('TMP', 12),
      pop: findValue('POP', 0),
    };
  }

  // ── 기상청 단기예보 — 매 1시간마다 수집 ─────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async collectWeatherData() {
    const serviceKey = this.config.get<string>('KMA_API_KEY');

    if (!serviceKey) {
      this.logger.warn('KMA_API_KEY가 없어 weather 수집을 건너뜁니다.');
      return;
    }

    try {
      const spots = await this.spots.findAll();
      if (!spots.length) {
        this.logger.warn('spots 데이터가 없어 weather 수집을 건너뜁니다.');
        return;
      }

      const grids = new Map<string, { nx: number; ny: number }>();
      for (const spot of spots) {
        const { nx, ny } = this.latLngToGrid(spot.lat, spot.lng);
        grids.set(`${nx}:${ny}`, { nx, ny });
      }

      const now = new Date();
      const baseDate = now.toISOString().slice(0, 10).replace(/-/g, '');
      for (const { nx, ny } of grids.values()) {
        const cacheKey = `weather:${nx}:${ny}`;
        try {
          const url =
            'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst' +
            `?serviceKey=${serviceKey}&numOfRows=200&pageNo=1&dataType=JSON` +
            `&base_date=${baseDate}&base_time=0500&nx=${nx}&ny=${ny}`;

          const response = await fetch(url);
          const data = (await response.json()) as {
            response?: { body?: { items?: { item?: Array<{ category?: string; fcstValue?: string }> } } };
          };
          const items = data.response?.body?.items?.item ?? [];
          if (!items.length) {
            throw new Error('기상청 응답 item이 비어 있습니다.');
          }

          const payload = {
            ...this.pickForecast(items),
            collectedAt: new Date().toISOString(),
          };
          await this.cache.set(cacheKey, payload, 3600 * 1000);
          this.logger.log(`weather 캐시 저장 완료: ${cacheKey}`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`weather 수집 실패(기존 캐시 유지): ${cacheKey} - ${msg}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`weather 수집 실패(기존 캐시 유지): ${msg}`);
    }
  }

  // ── 에어코리아 PM2.5 — 매 1시간마다 수집 ─────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async collectDustData() {
    const sido = '서울';
    const cacheKey = `dust:${sido}`;
    const serviceKey = this.config.get<string>('AIRKOREA_API_KEY');

    if (!serviceKey) {
      this.logger.warn('AIRKOREA_API_KEY가 없어 dust 수집을 건너뜁니다.');
      return;
    }

    try {
      const url =
        'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty' +
        `?serviceKey=${serviceKey}&returnType=json&numOfRows=10&pageNo=1&sidoName=${encodeURIComponent(
          sido,
        )}&ver=1.0`;

      const response = await fetch(url);
      const data = (await response.json()) as {
        response?: { body?: { items?: Array<{ pm25Value?: string }> } };
      };

      const items = data.response?.body?.items ?? [];
      const pm25 =
        items
          .map((v) => Number(v.pm25Value))
          .find((v) => Number.isFinite(v) && v >= 0) ?? 20;

      await this.cache.set(
        cacheKey,
        { pm25, collectedAt: new Date().toISOString() },
        3600 * 1000,
      );
      this.logger.log(`dust 캐시 저장 완료: ${cacheKey}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`dust 수집 실패(기존 캐시 유지): ${msg}`);
    }
  }

  // ── KASI 달 데이터 — 매일 자정 수집 ─────────────────────────
  @Cron('0 0 * * *')
  async collectMoonData() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const cacheKey = `moon:${date}`;
    try {
      const moon = await this.skyService.getMoonData(date);
      await this.cache.set(
        cacheKey,
        {
          phase: moon.lunPhase,
          altitude: moon.moonAltitude,
          moonrise: moon.moonrise,
          moonset: moon.moonset,
          collectedAt: new Date().toISOString(),
        },
        86400 * 1000,
      );
      this.logger.log(`moon 캐시 저장 완료: ${cacheKey}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`moon 수집 실패(기존 캐시 유지): ${msg}`);
    }
  }

  // ── 주간 TOP5 — 매주 월요일 오전 7시 갱신 ────────────────────
  @Cron('0 7 * * 1')
  async calcWeeklyTop5() {
    this.logger.log('주간 TOP5 산출 시작...');
    // TODO: 김세희(B) — 5주차 구현
    // cache.set(`top5:weekly:${week}`, data, 86400)
  }

  async runCollectionOnce(): Promise<void> {
    await this.collectWeatherData();
    await this.collectDustData();
    await this.collectMoonData();
  }

  async getCacheStatus(lat = 37.5665, lng = 126.978): Promise<{
    weatherKey: string;
    dustKey: string;
    moonKey: string;
    weatherExists: boolean;
    dustExists: boolean;
    moonExists: boolean;
  }> {
    const { nx, ny } = this.latLngToGrid(lat, lng);
    const weatherKey = `weather:${nx}:${ny}`;
    const dustKey = 'dust:서울';
    const moonKey = `moon:${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    const [weather, dust, moon] = await Promise.all([
      this.cache.get(weatherKey),
      this.cache.get(dustKey),
      this.cache.get(moonKey),
    ]);

    return {
      weatherKey,
      dustKey,
      moonKey,
      weatherExists: weather !== undefined && weather !== null,
      dustExists: dust !== undefined && dust !== null,
      moonExists: moon !== undefined && moon !== null,
    };
  }
}
