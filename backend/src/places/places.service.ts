import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildPlaceSearchQueries, normalizePlaceSearchQuery } from './places-search-query.util';
import { finalizePlaceSearchResults } from './places-search-rank.util';

export type PlaceSearchItem = {
  lat: number;
  lng: number;
  name: string;
  address: string;
};

type KakaoKeywordDocument = {
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  region_1depth_name?: string;
  region_2depth_name?: string;
  region_3depth_name?: string;
  x?: string;
  y?: string;
};

type KakaoAddressDocument = {
  address_name?: string;
  x?: string;
  y?: string;
};

type NominatimSearchRow = {
  lat?: string;
  lon?: string;
  display_name?: string;
};

const NOMINATIM_UA = 'StarChaser/1.0 (place-search; contact: local-dev)';

let lastNominatimAt = 0;

async function throttleNominatim(): Promise<void> {
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastNominatimAt = Date.now();
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  private kakaoKeyWarned = false;

  constructor(private readonly config: ConfigService) {}

  async search(keyword: string, limit = 10): Promise<PlaceSearchItem[]> {
    const q = normalizePlaceSearchQuery(keyword);
    if (!q) return [];

    const size = Math.max(1, Math.min(limit, 15));
    const fetchCap = size;
    const merged = new Map<string, PlaceSearchItem>();
    const addBatch = (batch: PlaceSearchItem[]) => {
      for (const item of batch) {
        const key = this.placeItemKey(item);
        if (!merged.has(key)) merged.set(key, item);
      }
    };

    const queries = buildPlaceSearchQueries(q);
    for (const query of queries) {
      addBatch(await this.searchOnce(query, fetchCap));
      if (merged.size >= fetchCap * 2) break;
    }

    return finalizePlaceSearchResults([...merged.values()], q, size);
  }

  private placeItemKey(item: PlaceSearchItem): string {
    return `${item.lat.toFixed(4)}:${item.lng.toFixed(4)}:${item.name}`;
  }

  private mergePlaceBatches(
    batches: PlaceSearchItem[][],
    cap: number,
  ): PlaceSearchItem[] {
    const merged = new Map<string, PlaceSearchItem>();
    for (const batch of batches) {
      for (const item of batch) {
        if (!merged.has(this.placeItemKey(item))) {
          merged.set(this.placeItemKey(item), item);
        }
        if (merged.size >= cap) break;
      }
      if (merged.size >= cap) break;
    }
    return [...merged.values()];
  }

  private async searchOnce(query: string, limit: number): Promise<PlaceSearchItem[]> {
    const apiKey = this.config.get<string>('KAKAO_REST_API_KEY')?.trim();

    if (apiKey) {
      const [keywordItems, addressItems] = await Promise.all([
        this.fetchKakaoKeyword(apiKey, query, limit),
        this.fetchKakaoAddress(apiKey, query, limit),
      ]);
      const merged = this.mergePlaceBatches([keywordItems, addressItems], limit);
      if (merged.length > 0) return merged;
    } else if (!this.kakaoKeyWarned) {
      this.kakaoKeyWarned = true;
      this.logger.warn(
        'KAKAO_REST_API_KEY 없음 — OpenStreetMap 검색으로 폴백합니다.',
      );
    }

    return this.searchNominatim(query, limit);
  }

  private async fetchKakaoKeyword(
    apiKey: string,
    query: string,
    size: number,
  ): Promise<PlaceSearchItem[]> {
    const url =
      'https://dapi.kakao.com/v2/local/search/keyword.json?' +
      `query=${encodeURIComponent(query)}&size=${size}`;
    const rows = await this.kakaoGet<KakaoKeywordDocument>(apiKey, url);
    return rows
      .map((d) => this.mapKeywordDoc(d, query))
      .filter((x): x is PlaceSearchItem => x != null);
  }

  private async fetchKakaoAddress(
    apiKey: string,
    query: string,
    size: number,
  ): Promise<PlaceSearchItem[]> {
    const url =
      'https://dapi.kakao.com/v2/local/search/address.json?' +
      `query=${encodeURIComponent(query)}&size=${size}`;
    const rows = await this.kakaoGet<KakaoAddressDocument>(apiKey, url);
    return rows
      .map((d) => this.mapAddressDoc(d, query))
      .filter((x): x is PlaceSearchItem => x != null);
  }

  private async kakaoGet<T>(apiKey: string, url: string): Promise<T[]> {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        if (!this.kakaoKeyWarned) {
          this.kakaoKeyWarned = true;
          this.logger.warn(
            `Kakao local HTTP ${response.status} — REST API 키를 확인하세요. ${body.slice(0, 120)}`,
          );
        }
        return [];
      }
      const data = (await response.json()) as { documents?: T[] };
      return Array.isArray(data.documents) ? data.documents : [];
    } catch (e) {
      this.logger.warn(`Kakao local fetch failed: ${String(e)}`);
      return [];
    }
  }

  private async searchNominatim(
    query: string,
    limit: number,
  ): Promise<PlaceSearchItem[]> {
    await throttleNominatim();
    const searchQ = encodeURIComponent(`${query}, South Korea`);
    const url =
      `https://nominatim.openstreetmap.org/search?q=${searchQ}` +
      `&format=json&limit=${limit}&accept-language=ko`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': NOMINATIM_UA },
      });
      if (!response.ok) {
        this.logger.warn(`Nominatim search HTTP ${response.status}`);
        return [];
      }
      const rows = (await response.json()) as NominatimSearchRow[];
      return rows
        .map((r) => this.mapNominatimRow(r, query))
        .filter((x): x is PlaceSearchItem => x != null);
    } catch (e) {
      this.logger.warn(`Nominatim search failed: ${String(e)}`);
      return [];
    }
  }

  private mapNominatimRow(
    row: NominatimSearchRow,
    fallbackName: string,
  ): PlaceSearchItem | null {
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const display = (row.display_name ?? '').trim();
    const parts = display.split(',').map((p) => p.trim()).filter(Boolean);
    const name = parts[0] || fallbackName;
    const address = parts.slice(0, 3).join(' ') || display || fallbackName;

    return { lat, lng, name, address };
  }

  private formatKakaoRegionAddress(d: KakaoKeywordDocument): string {
    const region = [d.region_1depth_name, d.region_2depth_name, d.region_3depth_name]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(' ');
    const street = (d.road_address_name ?? d.address_name ?? '').trim();
    if (region && street) {
      if (street.startsWith(region.split(' ')[0] ?? '')) return street;
      return `${region} ${street}`.trim();
    }
    return street || region;
  }

  private mapKeywordDoc(
    d: KakaoKeywordDocument,
    fallbackName: string,
  ): PlaceSearchItem | null {
    const lat = Number(d.y);
    const lng = Number(d.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const name = (d.place_name ?? fallbackName).trim();
    const address = this.formatKakaoRegionAddress(d) || name;
    return {
      lat,
      lng,
      name,
      address,
    };
  }

  private mapAddressDoc(
    d: KakaoAddressDocument,
    fallbackName: string,
  ): PlaceSearchItem | null {
    const lat = Number(d.y);
    const lng = Number(d.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const addr = (d.address_name ?? fallbackName).trim();
    const short = this.shortPlaceNameFromAddress(addr, fallbackName);
    return { lat, lng, name: short, address: addr };
  }

  /** 지번·도로명 주소에서 대표 지명(읍·면·동·리·건물) 추출 */
  private shortPlaceNameFromAddress(address: string, fallback: string): string {
    const parts = address.split(/\s+/).filter(Boolean);
    if (!parts.length) return fallback;
    const last = parts[parts.length - 1];
    if (/[가-힣]/.test(last) && last.length <= 20) return last;
    return parts[0] || fallback;
  }
}
