import { Logger } from '@nestjs/common';

const logger = new Logger('AirKoreaGeocode');

const NOMINATIM_UA = 'StarChaser/1.0 (air-quality; contact: local-dev)';

let lastNominatimAt = 0;

async function throttleNominatim(): Promise<void> {
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastNominatimAt = Date.now();
}

export type NominatimAddress = {
  city?: string;
  county?: string;
  borough?: string;
  town?: string;
  village?: string;
  province?: string;
};

/** 역지오코딩 — 행정구역 매칭 보조 */
export async function reverseGeocodeKo(
  lat: number,
  lng: number,
): Promise<NominatimAddress> {
  await throttleNominatim();
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}` +
    '&format=json&accept-language=ko';
  const response = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_UA },
  });
  if (!response.ok) {
    throw new Error(`Nominatim reverse HTTP ${response.status}`);
  }
  const data = (await response.json()) as { address?: NominatimAddress };
  return data.address ?? {};
}

/** 측정소명 + 시·도 → WGS84 (OSM Nominatim) */
export async function geocodeStation(
  stationName: string,
  sidoName: string,
): Promise<{ lat: number; lng: number } | null> {
  await throttleNominatim();
  const query = encodeURIComponent(
    `${sidoName} ${stationName} 대기환경측정소, South Korea`,
  );
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_UA },
  });
  if (!response.ok) {
    logger.warn(`Nominatim search HTTP ${response.status} — ${stationName}`);
    return null;
  }
  const rows = (await response.json()) as Array<{ lat: string; lon: string }>;
  const hit = rows[0];
  if (!hit) {
    return null;
  }
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
}

/** stationName에 행정구역 토큰이 포함되는지 — 동명 측정소 우선 */
export function scoreStationNameMatch(
  stationName: string,
  address: NominatimAddress,
): number {
  const tokens = [
    address.city,
    address.county,
    address.borough,
    address.town,
    address.village,
  ]
    .filter((t): t is string => Boolean(t && t.trim()))
    .map((t) => t.replace(/\s/g, ''));

  const name = stationName.replace(/\s/g, '');
  let score = 0;
  for (const raw of tokens) {
    const t = raw.replace(/(특별시|광역시|특별자치시|특별자치도|시|군|구|읍|면|동|리)$/g, '');
    if (t.length >= 2 && name.includes(t)) {
      score += 10;
    }
    if (raw.length >= 2 && name.includes(raw)) {
      score += 5;
    }
  }
  return score;
}
