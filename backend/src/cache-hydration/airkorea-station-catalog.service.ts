import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { arpltnInforUrl } from './airkorea-api.util';
import {
  extractAirKoreaItems,
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

const STATION_CATALOG_TTL_MS = 7 * 24 * 3600 * 1000;
const REVERSE_GEO_CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

const REVERSE_GEO_ROUND = 100_000;

@Injectable()
export class AirkoreaStationCatalogService {
  private readonly logger = new Logger(AirkoreaStationCatalogService.name);

  private catalogLoadLock: Promise<void> | null = null;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
  ) {}

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
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
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
}
