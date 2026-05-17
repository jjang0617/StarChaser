/** 에어코리아 측정소 카탈로그·캐시 키·최근접 측정소 선택 */

import type { AirKoreaStationRow } from './airkorea.util';

export type AirKoreaStationCatalogEntry = {
  stationName: string;
  /** 에어코리아 getCtprvnRltmMesureDnsty sidoName 과 동일 */
  sidoName: string;
  lat: number;
  lng: number;
  addr?: string;
};

export const AIRKOREA_SIDO_ADDRS = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
] as const;

export const AIRKOREA_STATION_CATALOG_CACHE_KEY = 'airkorea:station-catalog';

/** 측정소별 PM2.5 캐시 — stationName은 에어코리아 공식 명칭 */
export function dustStationCacheKey(stationName: string): string {
  return `dust:st:${stationName}`;
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hasStationCoords(s: AirKoreaStationCatalogEntry): boolean {
  return Number.isFinite(s.lat) && Number.isFinite(s.lng);
}

/**
 * getCtprvnRltmMesureDnsty item — 좌표 없이 stationName 만 사용 (폴백 카탈로그)
 */
export function parseStationCatalogFromCtprvn(
  rows: readonly Pick<AirKoreaStationRow, 'stationName'>[],
  sidoName: string,
): AirKoreaStationCatalogEntry[] {
  const seen = new Set<string>();
  const list: AirKoreaStationCatalogEntry[] = [];
  for (const row of rows) {
    const stationName = row.stationName?.trim();
    if (!stationName) continue;
    const dedupeKey = `${sidoName}\u0000${stationName}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    list.push({
      stationName,
      sidoName,
      lat: Number.NaN,
      lng: Number.NaN,
    });
  }
  return list;
}

/** 테스트 등 — 무좌표 항목에 좌표 부여 */
export function withStationCoords(
  entry: AirKoreaStationCatalogEntry,
  lat: number,
  lng: number,
): AirKoreaStationCatalogEntry {
  return { ...entry, lat, lng };
}

/**
 * getMsrstnList item — dmX=경도, dmY=위도 (WGS84, 에어코리아·공공데이터 관례)
 */
export function parseStationCatalogRow(
  row: Record<string, string | undefined>,
): AirKoreaStationCatalogEntry | null {
  const stationName = row.stationName?.trim();
  const lng = Number(row.dmX);
  const lat = Number(row.dmY);
  const sidoName = row.sidoNm?.trim() ?? '';
  if (!stationName || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < 32.5 || lat > 39.8 || lng < 124 || lng > 132.5) {
    return null;
  }
  return {
    stationName,
    sidoName,
    lat,
    lng,
    addr: row.addr?.trim(),
  };
}

/** 카탈로그에서 Haversine 최근접 측정소 (좌표 유효 항목만 전달할 것) */
export function findNearestStation(
  catalog: AirKoreaStationCatalogEntry[],
  lat: number,
  lng: number,
): AirKoreaStationCatalogEntry {
  if (!catalog.length) {
    throw new Error('에어코리아 측정소 카탈로그가 비어 있습니다.');
  }
  let best = catalog[0];
  let bestD = haversineKm(lat, lng, best.lat, best.lng);
  for (let i = 1; i < catalog.length; i += 1) {
    const s = catalog[i];
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}
