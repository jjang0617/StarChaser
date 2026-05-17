import * as fs from 'fs';
import { resolveBundledAssetPath } from '../common/resolve-bundled-asset.util';
import type { AirKoreaStationCatalogEntry } from './airkorea-station.util';

export type BundledStationCatalogFile = {
  version: number;
  generatedAt: string;
  stations: AirKoreaStationCatalogEntry[];
};

let bundledCache: AirKoreaStationCatalogEntry[] | null = null;

/** repo에 포함된 전국 측정소 좌표 (Nominatim 시드 스크립트로 생성) */
export function loadBundledStationCatalog(): AirKoreaStationCatalogEntry[] | null {
  if (bundledCache) {
    return bundledCache;
  }
  const filePath = resolveBundledAssetPath(
    __dirname,
    'cache-hydration',
    'airkorea-stations.json',
  );
  if (!filePath) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as BundledStationCatalogFile;
    const stations = parsed.stations?.filter(
      (s) =>
        s.stationName &&
        s.sidoName &&
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng),
    );
    if (!stations?.length) {
      return null;
    }
    bundledCache = stations;
    return bundledCache;
  } catch {
    return null;
  }
}
