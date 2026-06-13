import { getKstYmd } from '../common/kst-date';
import { latLngToGrid } from '../cache-hydration/kma-grid.util';

export type StarIndexInputCacheKeys = {
  weatherKey: string;
  dustKey: string;
  moonKey: string;
};

export function kstMoonCacheKey(): string {
  return `moon:${getKstYmd().replace(/-/g, '')}`;
}

export function weatherGridCacheKey(nx: number, ny: number): string {
  return `weather:${nx}:${ny}`;
}

export function buildInputCacheKeys(
  lat: number,
  lng: number,
  dustKey: string,
): StarIndexInputCacheKeys {
  const { nx, ny } = latLngToGrid(lat, lng);
  return {
    weatherKey: weatherGridCacheKey(nx, ny),
    dustKey,
    moonKey: kstMoonCacheKey(),
  };
}
