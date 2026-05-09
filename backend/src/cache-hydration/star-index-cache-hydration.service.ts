import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { SkyService } from '../sky/sky.service';
import { getKstYmd } from '../common/kst-date';

/**
 * Star-Index에 필요한 weather / dust / moon 키를 요청 시·cron 시 채움.
 * (CronModule ↔ StarIndexModule 순환 의존 방지용 분리)
 */
@Injectable()
export class StarIndexCacheHydrationService {
  private readonly logger = new Logger(StarIndexCacheHydrationService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
    private readonly skyService: SkyService,
  ) {}

  latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
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

  /** 단일 격자 기상 캐시 — 실패 시 예외 */
  async fetchAndStoreWeatherGrid(nx: number, ny: number): Promise<void> {
    const serviceKey = this.config.get<string>('KMA_API_KEY');
    if (!serviceKey) {
      throw new Error('KMA_API_KEY 없음');
    }
    const cacheKey = `weather:${nx}:${ny}`;
    const now = new Date();
    const baseDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    const url =
      'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst' +
      `?serviceKey=${serviceKey}&numOfRows=200&pageNo=1&dataType=JSON` +
      `&base_date=${baseDate}&base_time=0500&nx=${nx}&ny=${ny}`;
    const response = await fetch(url);
    const data = (await response.json()) as {
      response?: {
        body?: { items?: { item?: Array<{ category?: string; fcstValue?: string }> } };
      };
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
    this.logger.log(`weather 캐시 저장: ${cacheKey}`);
  }

  async fetchAndStoreDustSeoul(): Promise<void> {
    const sido = '서울';
    const cacheKey = `dust:${sido}`;
    const serviceKey = this.config.get<string>('AIRKOREA_API_KEY');
    if (!serviceKey) {
      throw new Error('AIRKOREA_API_KEY 없음');
    }
    const url =
      'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty' +
      `?serviceKey=${serviceKey}&returnType=json&numOfRows=10&pageNo=1&sidoName=${encodeURIComponent(
        sido,
      )}&ver=1.0`;
    const response = await fetch(url);
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} — ${rawText.slice(0, 200)}`);
    }
    let parsed: { response?: { body?: { items?: Array<{ pm25Value?: string }> } } };
    try {
      parsed = JSON.parse(rawText) as typeof parsed;
    } catch {
      throw new Error(
        `JSON 파싱 실패: ${rawText.slice(0, 120)}`,
      );
    }
    const items = parsed.response?.body?.items ?? [];
    const pm25 =
      items
        .map((v) => Number(v.pm25Value))
        .find((v) => Number.isFinite(v) && v >= 0) ?? 20;
    await this.cache.set(
      cacheKey,
      { pm25, collectedAt: new Date().toISOString() },
      3600 * 1000,
    );
    this.logger.log(`dust 캐시 저장: ${cacheKey}`);
  }

  /** KST 달력 기준 moon:YYYYMMDD — Star-Index와 동일 키 */
  async fetchAndStoreMoonKstToday(): Promise<void> {
    const ymd = getKstYmd().replace(/-/g, '');
    const cacheKey = `moon:${ymd}`;
    const moon = await this.skyService.getMoonData(ymd);
    await this.cache.set(
      cacheKey,
      {
        phase: moon.lunPhase,
        altitude: moon.moonAltitude,
        moonAltitudeKnown: moon.moonAltitudeKnown,
        moonrise: moon.moonrise,
        moonset: moon.moonset,
        collectedAt: new Date().toISOString(),
      },
      86400 * 1000,
    );
    this.logger.log(`moon 캐시 저장: ${cacheKey}`);
  }

  /**
   * GET /star-index 직전: 비어 있는 입력 캐시만 외부 API로 채움.
   */
  async ensureForStarIndexRequest(lat: number, lng: number): Promise<void> {
    const { nx, ny } = this.latLngToGrid(lat, lng);
    const weatherKey = `weather:${nx}:${ny}`;
    const dustKey = 'dust:서울';
    const moonKey = `moon:${getKstYmd().replace(/-/g, '')}`;

    const [w, d, m] = await Promise.all([
      this.cache.get(weatherKey),
      this.cache.get(dustKey),
      this.cache.get(moonKey),
    ]);

    if (!w) {
      try {
        await this.fetchAndStoreWeatherGrid(nx, ny);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`ensure weather 실패 ${weatherKey}: ${msg}`);
      }
    }
    if (!d) {
      try {
        await this.fetchAndStoreDustSeoul();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`ensure dust 실패: ${msg}`);
      }
    }
    if (!m) {
      try {
        await this.fetchAndStoreMoonKstToday();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`ensure moon 실패: ${msg}`);
      }
    }
  }
}
