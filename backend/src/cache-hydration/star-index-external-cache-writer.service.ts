import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import type { VilageFcstItem } from './kma-forecast.util';
import {
  parseForecastNumbers,
  resolveVilageFcstBaseKst,
} from './kma-forecast.util';
import { moonStateAtObserver } from '../sky/moon-ephemeris.util';
import { arpltnInforUrl } from './airkorea-api.util';
import {
  extractAirKoreaItems,
  pickPm25ForStationName,
  pickPm25SidoFallback,
  type AirKoreaItemsBody,
} from './airkorea.util';
import {
  AIRKOREA_SIDO_ADDRS,
  dustStationCacheKey,
  findDustStationInCatalog,
  hasStationCoords,
} from './airkorea-station.util';
import { latLngToGrid } from './kma-grid.util';
import {
  kstMoonCacheKey,
  weatherGridCacheKey,
} from '../star-index/star-index-cache-keys.util';
import { AirkoreaStationCatalogService } from './airkorea-station-catalog.service';

const REF_LAT = 37.5665;
const REF_LNG = 126.978;

const WEATHER_CACHE_TTL_MS = 3 * 3600 * 1000; // 3 hours
const DUST_STATION_CACHE_TTL_MS = 3 * 3600 * 1000; // 3 hours
const MOON_CACHE_TTL_MS = 86400 * 1000;

@Injectable()
export class StarIndexExternalCacheWriterService {
  private readonly logger = new Logger(StarIndexExternalCacheWriterService.name);

  /** 동시 요청 시 시도별 dust API 중복 호출 방지 */
  private readonly sidoDustInflight = new Map<string, Promise<void>>();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
    private readonly stationCatalog: AirkoreaStationCatalogService,
  ) {}

  latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
    return latLngToGrid(lat, lng);
  }

  /** Cron·관리 확인용 — 입력 캐시 키 존재 여부 */
  async getInputCacheStatus(
    lat: number,
    lng: number,
    fixedDustStationName?: string | null,
  ): Promise<{
    weatherKey: string;
    dustKey: string;
    moonKey: string;
    weatherExists: boolean;
    dustExists: boolean;
    moonExists: boolean;
  }> {
    const { nx, ny } = latLngToGrid(lat, lng);
    const weatherKey = weatherGridCacheKey(nx, ny);
    const dustKey = await this.stationCatalog.resolveDustCacheKey(
      lat,
      lng,
      fixedDustStationName,
    );
    const moonKey = kstMoonCacheKey();

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

  /**
   * 여러 좌표의 입력 캐시(weather/dust/moon)를 격자·측정소 단위로 dedupe 후 병렬 채움
   */
  async ensureForStarIndexBatch(
    locations: {
      lat: number;
      lng: number;
      dustStationName?: string | null;
    }[],
  ): Promise<void> {
    if (!locations.length) {
      return;
    }

    await this.stationCatalog.ensureStationCatalog();
    const catalog = await this.stationCatalog.getStationCatalogCached();
    const moonKey = kstMoonCacheKey();

    const grids = new Map<string, { nx: number; ny: number }>();
    const dustStationNames = new Set<string>();

    for (const loc of locations) {
      const { lat, lng, dustStationName } = loc;
      const { nx, ny } = this.latLngToGrid(lat, lng);
      grids.set(`${nx}:${ny}`, { nx, ny });
      if (dustStationName?.trim()) {
        dustStationNames.add(dustStationName.trim());
        continue;
      }
      try {
        const nearest = findDustStationInCatalog(catalog, lat, lng);
        dustStationNames.add(nearest.stationName);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`배치 dust 측정소 결정 생략 lat=${lat}: ${msg}`);
      }
    }

    const moonRaw = await this.cache.get(moonKey);

    const tasks: Promise<void>[] = [];

    for (const { nx, ny } of grids.values()) {
      const weatherKey = weatherGridCacheKey(nx, ny);
      tasks.push(
        (async () => {
          try {
            const hit = await this.cache.get(weatherKey);
            if (!hit) {
              await this.fetchAndStoreWeatherGrid(nx, ny);
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`ensure batch weather 실패 ${weatherKey}: ${msg}`);
          }
        })(),
      );
    }

    const sidosNeedingDust = new Set<string>();
    for (const stationName of dustStationNames) {
      const dustKey = dustStationCacheKey(stationName);
      const hit = await this.cache.get(dustKey);
      if (hit) continue;
      const entry = catalog.find((c) => c.stationName === stationName);
      if (entry) {
        sidosNeedingDust.add(entry.sidoName);
      }
    }
    for (const sidoName of sidosNeedingDust) {
      tasks.push(
        this.fetchAndStoreDustForSido(sidoName).catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`ensure batch dust 실패 sido=${sidoName}: ${msg}`);
        }),
      );
    }

    if (!moonRaw) {
      tasks.push(
        this.fetchAndStoreMoonKstToday(REF_LAT, REF_LNG).catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`ensure batch moon 실패: ${msg}`);
        }),
      );
    }

    await Promise.all(tasks);
  }

  /** 단일 격자 기상 캐시 — KMA base 시각 해석 후 parseForecastNumbers */
  async fetchAndStoreWeatherGrid(nx: number, ny: number): Promise<void> {
    const serviceKey = this.config.get<string>('KMA_API_KEY');
    if (!serviceKey) {
      throw new Error('KMA_API_KEY 없음');
    }
    const cacheKey = weatherGridCacheKey(nx, ny);
    const { baseDate, baseTime } = resolveVilageFcstBaseKst(new Date());

    const url =
      'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst' +
      `?serviceKey=${encodeURIComponent(serviceKey)}&numOfRows=300&pageNo=1&dataType=JSON` +
      `&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`기상청 HTTP ${response.status}: ${rawText.slice(0, 240)}`);
    }

    let data: {
      response?: {
        header?: { resultCode?: string; resultMsg?: string };
        body?: { items?: { item?: VilageFcstItem | VilageFcstItem[] } };
      };
    };
    try {
      data = JSON.parse(rawText) as typeof data;
    } catch {
      throw new Error(`기상청 JSON 파싱 실패: ${rawText.slice(0, 160)}`);
    }

    const hdr = data.response?.header;
    if (hdr && hdr.resultCode !== undefined && hdr.resultCode !== '00') {
      throw new Error(
        `기상청 API 코드 ${hdr.resultCode}: ${hdr.resultMsg ?? ''}`.trim(),
      );
    }

    const rawItems = data.response?.body?.items?.item ?? [];
    const items: VilageFcstItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

    if (!items.length) {
      throw new Error(
        `기상 단기예보 item 비어 있음 (${nx}, ${ny}) base=${baseDate} ${baseTime}`,
      );
    }

    const nums = parseForecastNumbers(items, new Date());
    await this.cache.set(
      cacheKey,
      {
        skyCode: nums.skyCode,
        cloud: nums.cloud,
        humidity: nums.humidity,
        windSpeed: nums.windSpeed,
        visibility: nums.visibility,
        visibilityKnown: nums.visibilityKnown,
        temperature: nums.temperature,
        pop: nums.pop,
        pty: nums.pty,
        fcstItems: items,
        collectedAt: new Date().toISOString(),
      },
      WEATHER_CACHE_TTL_MS,
    );
    this.logger.log(`weather 캐시 저장: ${cacheKey}`);
  }

  /** 시도별 실시간 농도 일괄 — getCtprvnRltmMesureDnsty 1회로 대표 측정소 PM2.5 저장 */
  async fetchAndStoreDustForSido(sidoName: string): Promise<void> {
    const inflight = this.sidoDustInflight.get(sidoName);
    if (inflight) {
      return inflight;
    }
    const job = this.fetchAndStoreDustForSidoOnce(sidoName).finally(() => {
      this.sidoDustInflight.delete(sidoName);
    });
    this.sidoDustInflight.set(sidoName, job);
    return job;
  }

  private async fetchAndStoreDustForSidoOnce(sidoName: string): Promise<void> {
    const serviceKey = this.config.get<string>('AIRKOREA_API_KEY');
    if (!serviceKey) {
      throw new Error('AIRKOREA_API_KEY 없음');
    }

    await this.stationCatalog.ensureStationCatalog();
    const catalog = await this.stationCatalog.getStationCatalogCached();
    const reps = catalog.filter(
      (e) => e.sidoName === sidoName && hasStationCoords(e),
    );
    if (!reps.length) {
      this.logger.warn(`dust 시도 수집 생략 — 대표 측정소 없음: ${sidoName}`);
      return;
    }

    const items = await this.fetchCtprvnRowsForSido(sidoName, serviceKey);
    const collectedAt = new Date().toISOString();
    const sidoFallback = pickPm25SidoFallback(items);
    let saved = 0;

    for (const rep of reps) {
      let picked = pickPm25ForStationName(items, rep.stationName);
      if (!picked && sidoFallback) {
        picked = {
          ...sidoFallback,
          stationName: rep.stationName,
        };
        this.logger.debug(
          `dust PM2.5 시도 폴백 — ${rep.stationName} ← API ${sidoFallback.stationName ?? '?'}`,
        );
      }
      if (!picked) {
        this.logger.warn(
          `dust PM2.5 없음 — sido=${sidoName} station=${rep.stationName}`,
        );
        continue;
      }
      await this.cache.set(
        dustStationCacheKey(rep.stationName),
        {
          pm25: picked.pm25,
          pm25Label: picked.pm25Label,
          stationName: rep.stationName,
          collectedAt,
        },
        DUST_STATION_CACHE_TTL_MS,
      );
      saved += 1;
    }

    this.logger.log(
      `dust 시도 캐시 저장 — ${sidoName} 대표 ${saved}/${reps.length}곳 (API 1회)`,
    );
  }

  /** 단일 측정소 — 해당 시도 일괄 수집으로 위임 (레거시 per-station API 제거) */
  async fetchAndStoreDustForStation(stationName: string): Promise<void> {
    await this.stationCatalog.ensureStationCatalog();
    const catalog = await this.stationCatalog.getStationCatalogCached();
    const entry = catalog.find((c) => c.stationName === stationName);
    if (entry) {
      await this.fetchAndStoreDustForSido(entry.sidoName);
      return;
    }
    throw new Error(
      `대표 측정소 카탈로그에 없음: ${stationName} — 시도 일괄 수집만 지원합니다.`,
    );
  }

  private async fetchCtprvnRowsForSido(
    sidoName: string,
    serviceKey: string,
  ): Promise<ReturnType<typeof extractAirKoreaItems>> {
    const url = arpltnInforUrl('getCtprvnRltmMesureDnsty', {
      serviceKey,
      returnType: 'json',
      numOfRows: '500',
      pageNo: '1',
      sidoName,
      ver: '1.0',
    });
    const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(
        `dust sido HTTP ${response.status} ${sidoName}: ${rawText.slice(0, 180)}`,
      );
    }
    let body: { response?: { body?: AirKoreaItemsBody } };
    try {
      body = JSON.parse(rawText) as typeof body;
    } catch {
      throw new Error(`dust sido JSON 파싱 실패: ${sidoName}`);
    }
    return extractAirKoreaItems(body.response?.body);
  }

  /** KST 날짜 키 moon:YYYYMMDD — 기본 서울시청 근처 REF 좌표 (astronomy-engine) */
  async fetchAndStoreMoonKstToday(
    observerLat?: number,
    observerLng?: number,
  ): Promise<void> {
    const cacheKey = kstMoonCacheKey();
    const latDeg = observerLat ?? REF_LAT;
    const lngDeg = observerLng ?? REF_LNG;
    const moon = moonStateAtObserver(latDeg, lngDeg, new Date());
    await this.cache.set(
      cacheKey,
      {
        phase: moon.phase,
        altitude: moon.altitude,
        moonAltitudeKnown: moon.moonAltitudeKnown,
        collectedAt: new Date().toISOString(),
      },
      MOON_CACHE_TTL_MS,
    );
    this.logger.log(`moon 캐시 저장: ${cacheKey}`);
  }

  /** GET /star-index 직전: 비어 있는 입력 캐시만 외부 API로 채움 */
  async ensureForStarIndexRequest(
    lat: number,
    lng: number,
    fixedDustStationName?: string | null,
  ): Promise<void> {
    const { nx, ny } = this.latLngToGrid(lat, lng);
    const weatherKey = weatherGridCacheKey(nx, ny);
    let dustKey = '';
    try {
      dustKey = await this.stationCatalog.resolveDustCacheKey(
        lat,
        lng,
        fixedDustStationName,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`dust 캐시 키 결정 실패: ${msg}`);
    }
    const moonKey = kstMoonCacheKey();

    const [w, d, m] = await Promise.all([
      this.cache.get(weatherKey),
      dustKey ? this.cache.get(dustKey) : Promise.resolve(undefined),
      this.cache.get(moonKey),
    ]);

    const ensureTasks: Promise<void>[] = [];

    if (!w) {
      ensureTasks.push(
        this.fetchAndStoreWeatherGrid(nx, ny).catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`ensure weather 실패 ${weatherKey}: ${msg}`);
        }),
      );
    }
    if (dustKey && !d) {
      const station =
        dustKey.startsWith('dust:st:') ? dustKey.slice('dust:st:'.length) : '';
      if (station) {
        ensureTasks.push(
          this.fetchAndStoreDustForStation(station).catch((e) => {
            const msg = e instanceof Error ? e.message : String(e);
            this.logger.warn(`ensure dust 실패 ${dustKey}: ${msg}`);
          }),
        );
      }
    }
    if (!m) {
      ensureTasks.push(
        this.fetchAndStoreMoonKstToday(REF_LAT, REF_LNG).catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`ensure moon 실패: ${msg}`);
        }),
      );
    }

    if (ensureTasks.length > 0) {
      await Promise.all(ensureTasks);
    }
  }

  /** Cron: 시도 17회 API로 전국 대표 측정소 PM2.5 수집 (명소 수·625측정소와 무관) */
  async fetchAndStoreDustForAllSpots(): Promise<void> {
    if (!this.config.get<string>('AIRKOREA_API_KEY')) {
      throw new Error('AIRKOREA_API_KEY 없음');
    }

    await this.stationCatalog.ensureStationCatalog();

    for (const sidoName of AIRKOREA_SIDO_ADDRS) {
      try {
        await this.fetchAndStoreDustForSido(sidoName);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`dust 시도 수집 실패(건너뜀) ${sidoName}: ${msg}`);
      }
    }
  }
}
