import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { getKstYmd } from '../common/kst-date';
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
  type AirKoreaItemsBody,
} from './airkorea.util';
import { loadBundledStationCatalog } from './airkorea-station-bundled.loader';
import { findSidoByLatLng } from './airkorea-sido-bbox.util';
import {
  reverseGeocodeKo,
  scoreStationNameMatch,
  type NominatimAddress,
} from './airkorea-geocode.util';
import {
  AIRKOREA_SIDO_ADDRS,
  AIRKOREA_STATION_CATALOG_CACHE_KEY,
  dustStationCacheKey,
  findDustStationInCatalog,
  findNearestStation,
  haversineKm,
  hasStationCoords,
  parseStationCatalogFromCtprvn,
  pickRepresentativeStations,
  REPRESENTATIVE_STATIONS_PER_SIDO,
  type AirKoreaStationCatalogEntry,
} from './airkorea-station.util';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
} from '../common/interfaces/spot.repository';

const REF_LAT = 37.5665;
const REF_LNG = 126.978;

const STATION_CATALOG_TTL_MS = 7 * 24 * 3600 * 1000;
const REVERSE_GEO_CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
const WEATHER_CACHE_TTL_MS = 3600 * 1000;
const DUST_STATION_CACHE_TTL_MS = 3600 * 1000;
const MOON_CACHE_TTL_MS = 86400 * 1000;

const REVERSE_GEO_ROUND = 100_000;

/**
 * Star-Index에 필요한 weather / dust / moon 키를 요청 시·cron 시 채움.
 * (CronModule ↔ StarIndexModule 순환 의존 방지용 분리)
 */
@Injectable()
export class StarIndexCacheHydrationService {
  private readonly logger = new Logger(StarIndexCacheHydrationService.name);

  private catalogLoadLock: Promise<void> | null = null;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
    @Inject(SPOT_REPOSITORY) private readonly spots: SpotRepository,
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

  /** 캐시된 전국 카탈로그 — 없거나 비었으면 ensureStationCatalog 후 재조회 */
  async getStationCatalogCached(): Promise<AirKoreaStationCatalogEntry[]> {
    const rows = await this.cache.get<AirKoreaStationCatalogEntry[]>(
      AIRKOREA_STATION_CATALOG_CACHE_KEY,
    );
    if (rows?.length) {
      if (rows.length > AIRKOREA_SIDO_ADDRS.length * REPRESENTATIVE_STATIONS_PER_SIDO + 4) {
        const slim = pickRepresentativeStations(
          rows.filter(hasStationCoords),
          REPRESENTATIVE_STATIONS_PER_SIDO,
        );
        await this.cache.set(
          AIRKOREA_STATION_CATALOG_CACHE_KEY,
          slim,
          STATION_CATALOG_TTL_MS,
        );
        this.logger.log(
          `측정소 카탈로그 슬림화 — ${rows.length}곳 → ${slim.length}곳`,
        );
        return slim;
      }
      return rows;
    }
    await this.ensureStationCatalog();
    const again = await this.cache.get<AirKoreaStationCatalogEntry[]>(
      AIRKOREA_STATION_CATALOG_CACHE_KEY,
    );
    return Array.isArray(again) ? again : [];
  }

  private reverseGeoCacheKey(lat: number, lng: number): string {
    const rLat = Math.round(lat * REVERSE_GEO_ROUND);
    const rLng = Math.round(lng * REVERSE_GEO_ROUND);
    return `airkorea:reverse-geocode:${rLat}:${rLng}`;
  }

  private async getReverseGeocodeCached(
    lat: number,
    lng: number,
  ): Promise<NominatimAddress | null> {
    const ck = this.reverseGeoCacheKey(lat, lng);
    const hit = await this.cache.get<NominatimAddress>(ck);
    if (hit !== undefined && hit !== null) {
      return hit;
    }
    const addr = await reverseGeocodeKo(lat, lng);
    await this.cache.set(ck, addr, REVERSE_GEO_CACHE_TTL_MS);
    return addr;
  }

  /**
   * 1) 레포 포함 bundled JSON 우선
   * 2) 없으면 17개 시도 getCtprvnRltmMesureDnstry로 stationName 목록만 수집 (좌표 없음 가능)
   */
  async ensureStationCatalog(): Promise<void> {
    const existing = await this.cache.get<unknown>(AIRKOREA_STATION_CATALOG_CACHE_KEY);
    if (Array.isArray(existing) && existing.length > 0) {
      return;
    }
    if (this.catalogLoadLock) {
      return this.catalogLoadLock;
    }
    this.catalogLoadLock = this.loadStationCatalogFresh().finally(() => {
      this.catalogLoadLock = null;
    });
    await this.catalogLoadLock;
  }

  private mergeCatalogDedupe(
    parts: readonly AirKoreaStationCatalogEntry[],
  ): AirKoreaStationCatalogEntry[] {
    const map = new Map<string, AirKoreaStationCatalogEntry>();
    for (const e of parts) {
      const key = `${e.sidoName}\u0000${e.stationName}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...e });
        continue;
      }
      const coords = hasStationCoords(e)
        ? e
        : hasStationCoords(prev)
          ? prev
          : e;
      map.set(key, {
        stationName: e.stationName,
        sidoName: e.sidoName || prev.sidoName,
        lat: coords.lat,
        lng: coords.lng,
        addr: e.addr ?? prev.addr,
      });
    }
    return [...map.values()];
  }

  private async loadStationCatalogFresh(): Promise<void> {
    const bundled = loadBundledStationCatalog();
    if (bundled?.length) {
      await this.cache.set(
        AIRKOREA_STATION_CATALOG_CACHE_KEY,
        bundled,
        STATION_CATALOG_TTL_MS,
      );
      this.logger.log(
        `에어코리아 측정소 카탈로그(번들 JSON) 저장 — ${bundled.length}곳`,
      );
      return;
    }

    const serviceKey = this.config.get<string>('AIRKOREA_API_KEY');
    if (!serviceKey) {
      this.logger.warn('AIRKOREA_API_KEY 없음 — 카탈로그 API 폴백 생략');
      await this.cache.set(AIRKOREA_STATION_CATALOG_CACHE_KEY, [], STATION_CATALOG_TTL_MS);
      return;
    }

    const merged: AirKoreaStationCatalogEntry[] = [];
    for (const sidoName of AIRKOREA_SIDO_ADDRS) {
      try {
        const url = arpltnInforUrl('getCtprvnRltmMesureDnsty', {
          serviceKey,
          returnType: 'json',
          numOfRows: '500',
          pageNo: '1',
          sidoName,
          ver: '1.0',
        });
        const res = await fetch(url);
        const text = await res.text();
        if (!res.ok) {
          this.logger.warn(
            `getCtprvnRltmMesureDnsty 실패 sido=${sidoName} HTTP ${res.status}`,
          );
          continue;
        }
        let body: unknown;
        try {
          body = JSON.parse(text) as {
            response?: { body?: { items?: unknown } };
          };
        } catch {
          this.logger.warn(`getCtprvnRltmMesureDnsty JSON 파싱 실패 sido=${sidoName}`);
          continue;
        }
        const rows = extractAirKoreaItems(
          (body as { response?: { body?: AirKoreaItemsBody } }).response?.body,
        );
        merged.push(...parseStationCatalogFromCtprvn(rows, sidoName));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`getCtprvnRltmMesureDnsty sido=${sidoName} 예외: ${msg}`);
      }
    }

    const mergedCatalog = this.mergeCatalogDedupe(merged);
    const catalog = pickRepresentativeStations(
      mergedCatalog.filter(hasStationCoords),
      REPRESENTATIVE_STATIONS_PER_SIDO,
    );
    await this.cache.set(
      AIRKOREA_STATION_CATALOG_CACHE_KEY,
      catalog,
      STATION_CATALOG_TTL_MS,
    );
    this.logger.log(
      `에어코리아 측정소 카탈로그(API 폴백) 저장 — ${catalog.length}곳 (대표 ${REPRESENTATIVE_STATIONS_PER_SIDO}/시도)`,
    );
  }

  /**
   * 시도 bbox → 같은 sido 항목·좌표 있는 측정소만 두고 역지오코딩 스코어로 정렬 가능 시 보정 후 최근접.
   */
  async resolveNearestStation(
    lat: number,
    lng: number,
  ): Promise<AirKoreaStationCatalogEntry> {
    const catalog = await this.getStationCatalogCached();
    const sidoName = findSidoByLatLng(lat, lng);
    let withCoords = catalog.filter(
      (e) => e.sidoName === sidoName && hasStationCoords(e),
    );
    if (!withCoords.length) {
      withCoords = catalog.filter(hasStationCoords);
    }
    if (!withCoords.length) {
      throw new Error(
        '좌표가 있는 에어코리아 측정소가 없습니다. 번들 airkorea-stations.json 또는 API 결과를 확인하세요.',
      );
    }

    let address: NominatimAddress | null = null;
    try {
      address = await this.getReverseGeocodeCached(lat, lng);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.debug(`역지오코딩 생략 (${msg})`);
    }

    if (address && Object.keys(address).length > 0) {
      type Scored = { entry: AirKoreaStationCatalogEntry; rank: number; d: number };
      const ranked: Scored[] = withCoords.map((entry) => {
        const score = scoreStationNameMatch(entry.stationName, address ?? {});
        const d = haversineKm(lat, lng, entry.lat, entry.lng);
        const rank =
          score * 1_000_000 - Math.min(d, 9_999) * 100;
        return { entry, rank, d };
      });
      ranked.sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        return a.d - b.d;
      });
      return ranked[0].entry;
    }

    return findNearestStation(withCoords, lat, lng);
  }

  /**
   * 배치·지도 목록용 — 역지오코딩(Nominatim) 없이 시도 bbox + 최근접 측정소만 사용
   */
  resolveNearestStationFast(
    lat: number,
    lng: number,
    catalog: AirKoreaStationCatalogEntry[],
  ): AirKoreaStationCatalogEntry {
    return findDustStationInCatalog(catalog, lat, lng);
  }

  /**
   * Star-Index·Cron — dust:st:{측정소} 캐시 키
   * @param fixedStationName spots.dust_station_name (시드 고정 시 역지오/탐색 생략)
   */
  async resolveDustCacheKey(
    lat: number,
    lng: number,
    fixedStationName?: string | null,
  ): Promise<string> {
    if (fixedStationName?.trim()) {
      return dustStationCacheKey(fixedStationName.trim());
    }
    await this.ensureStationCatalog();
    const catalog = await this.getStationCatalogCached();
    const nearest = findDustStationInCatalog(catalog, lat, lng);
    return dustStationCacheKey(nearest.stationName);
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

    await this.ensureStationCatalog();
    const catalog = await this.getStationCatalogCached();
    const moonKey = `moon:${getKstYmd().replace(/-/g, '')}`;

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
      const weatherKey = `weather:${nx}:${ny}`;
      tasks.push(
        (async () => {
          const hit = await this.cache.get(weatherKey);
          if (!hit) {
            await this.fetchAndStoreWeatherGrid(nx, ny);
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
      tasks.push(this.fetchAndStoreDustForSido(sidoName));
    }

    if (!moonRaw) {
      tasks.push(this.fetchAndStoreMoonKstToday(REF_LAT, REF_LNG));
    }

    await Promise.all(tasks);
  }

  /** 단일 격자 기상 캐시 — KMA base 시각 해석 후 parseForecastNumbers */
  async fetchAndStoreWeatherGrid(nx: number, ny: number): Promise<void> {
    const serviceKey = this.config.get<string>('KMA_API_KEY');
    if (!serviceKey) {
      throw new Error('KMA_API_KEY 없음');
    }
    const cacheKey = `weather:${nx}:${ny}`;
    const { baseDate, baseTime } = resolveVilageFcstBaseKst(new Date());

    const url =
      'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst' +
      `?serviceKey=${encodeURIComponent(serviceKey)}&numOfRows=300&pageNo=1&dataType=JSON` +
      `&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;
    const response = await fetch(url);
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
    const serviceKey = this.config.get<string>('AIRKOREA_API_KEY');
    if (!serviceKey) {
      throw new Error('AIRKOREA_API_KEY 없음');
    }

    await this.ensureStationCatalog();
    const catalog = await this.getStationCatalogCached();
    const reps = catalog.filter(
      (e) => e.sidoName === sidoName && hasStationCoords(e),
    );
    if (!reps.length) {
      this.logger.warn(`dust 시도 수집 생략 — 대표 측정소 없음: ${sidoName}`);
      return;
    }

    const items = await this.fetchCtprvnRowsForSido(sidoName, serviceKey);
    const collectedAt = new Date().toISOString();
    let saved = 0;

    for (const rep of reps) {
      const picked = pickPm25ForStationName(items, rep.stationName);
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
    await this.ensureStationCatalog();
    const catalog = await this.getStationCatalogCached();
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
    const response = await fetch(url);
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
    const ymd = getKstYmd().replace(/-/g, '');
    const cacheKey = `moon:${ymd}`;
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
    const weatherKey = `weather:${nx}:${ny}`;
    let dustKey = '';
    try {
      dustKey = await this.resolveDustCacheKey(lat, lng, fixedDustStationName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`dust 캐시 키 결정 실패: ${msg}`);
    }
    const moonKey = `moon:${getKstYmd().replace(/-/g, '')}`;

    const [w, d, m] = await Promise.all([
      this.cache.get(weatherKey),
      dustKey ? this.cache.get(dustKey) : Promise.resolve(undefined),
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
    if (dustKey && !d) {
      try {
        const station =
          dustKey.startsWith('dust:st:') ? dustKey.slice('dust:st:'.length) : '';
        if (station) {
          await this.fetchAndStoreDustForStation(station);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`ensure dust 실패 ${dustKey}: ${msg}`);
      }
    }
    if (!m) {
      try {
        await this.fetchAndStoreMoonKstToday(REF_LAT, REF_LNG);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`ensure moon 실패: ${msg}`);
      }
    }
  }

  /** Cron: 시도 17회 API로 전국 대표 측정소 PM2.5 수집 (명소 수·625측정소와 무관) */
  async fetchAndStoreDustForAllSpots(): Promise<void> {
    if (!this.config.get<string>('AIRKOREA_API_KEY')) {
      throw new Error('AIRKOREA_API_KEY 없음');
    }

    await this.ensureStationCatalog();

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
