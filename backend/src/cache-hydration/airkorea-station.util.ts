/** 에어코리아 측정소 카탈로그·캐시 키·최근접 측정소 선택 */

import { findSidoByLatLng } from './airkorea-sido-bbox.util';
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

/** 시도당 대표 측정소 수 — Star-Index·cron API 부하 절감 (전국 625곳 → 약 34곳) */
export const REPRESENTATIVE_STATIONS_PER_SIDO = 2;

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

/**
 * 대표 측정소 카탈로그에서 PM2.5용 최근접 측정소 (역지오코딩 없음 — DIARY·지도·시드 공통)
 */
export function findDustStationInCatalog(
  catalog: readonly AirKoreaStationCatalogEntry[],
  lat: number,
  lng: number,
): AirKoreaStationCatalogEntry {
  const sidoName = findSidoByLatLng(lat, lng);
  let withCoords = catalog.filter(
    (e) => e.sidoName === sidoName && hasStationCoords(e),
  );
  if (!withCoords.length) {
    withCoords = catalog.filter(hasStationCoords);
  }
  if (!withCoords.length) {
    throw new Error('에어코리아 대표 측정소 카탈로그가 비어 있습니다.');
  }
  return findNearestStation(withCoords, lat, lng);
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

/**
 * 시도별 대표 측정소만 남김(위도 최북·최남, 동일 시 경도로 2번째).
 * 근처 명소는 이 소수 측정소로 PM2.5를 공유 — dust:st:* 캐시·API 호출 수 대폭 감소.
 */
export function pickRepresentativeStations(
  catalog: readonly AirKoreaStationCatalogEntry[],
  maxPerSido = REPRESENTATIVE_STATIONS_PER_SIDO,
): AirKoreaStationCatalogEntry[] {
  const cap = Math.max(1, maxPerSido);
  const bySido = new Map<string, AirKoreaStationCatalogEntry[]>();

  for (const entry of catalog) {
    if (!hasStationCoords(entry)) continue;
    const list = bySido.get(entry.sidoName) ?? [];
    list.push(entry);
    bySido.set(entry.sidoName, list);
  }

  const out: AirKoreaStationCatalogEntry[] = [];

  for (const list of bySido.values()) {
    if (list.length <= cap) {
      out.push(...list);
      continue;
    }

    let north = list[0];
    let south = list[0];
    for (const s of list) {
      if (s.lat > north.lat) north = s;
      if (s.lat < south.lat) south = s;
    }

    const picked = new Map<string, AirKoreaStationCatalogEntry>();
    picked.set(north.stationName, north);
    if (south.stationName !== north.stationName) {
      picked.set(south.stationName, south);
    }

    if (picked.size < cap) {
      let far = list[0];
      let bestD = -1;
      for (const s of list) {
        if (picked.has(s.stationName)) continue;
        const d = haversineKm(north.lat, north.lng, s.lat, s.lng);
        if (d > bestD) {
          bestD = d;
          far = s;
        }
      }
      picked.set(far.stationName, far);
    }

    out.push(...picked.values());
  }

  return out;
}
