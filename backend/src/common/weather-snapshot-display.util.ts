import {
  cloudPercentToSkyCode,
  skyCodeToLabel,
} from '../cache-hydration/kma-forecast.util';
import type { WeatherSnapshot } from './interfaces/weather-snapshot';

export type LegacyWeatherCache = {
  skyCode?: number;
  cloud?: number;
  humidity?: number;
  windSpeed?: number;
  visibility?: number;
  visibilityKnown?: boolean;
  temperature?: number;
  pop?: number;
  pty?: number;
};
export type NormalizedWeatherCache = {
  skyCode: number;
  cloud: number;
};

export function normalizeWeatherCacheEntry(
  e: unknown,
): NormalizedWeatherCache | null {
  if (e === null || typeof e !== 'object') return null;
  const o = e as LegacyWeatherCache;
  const cloudNum = Number(o.cloud);
  const skyRaw = Number(o.skyCode);
  const skyCode = Number.isFinite(skyRaw)
    ? skyRaw
    : Number.isFinite(cloudNum)
      ? cloudPercentToSkyCode(cloudNum)
      : NaN;
  const cloud = Number.isFinite(cloudNum) ? cloudNum : NaN;
  if (!Number.isFinite(skyCode) || !Number.isFinite(cloud)) return null;
  return { skyCode, cloud };
}

export type LegacyDustCache = {
  pm25?: string | number;
  pm25Label?: string;
  stationName?: string;
};
export type NormalizedDustCache = {
  pm25?: number;
  pm25Label?: string;
  stationName?: string;
};

export function normalizeDustCacheEntry(e: unknown): NormalizedDustCache | null {
  if (e === null || typeof e !== 'object') return null;
  const d = e as LegacyDustCache;
  const raw =
    typeof d.pm25 === 'number' ? d.pm25 : Number(String(d.pm25 ?? '').trim());
  if (!Number.isFinite(raw) || raw < 0) return null;
  return {
    pm25: raw,
    pm25Label: d.pm25Label,
    stationName: d.stationName,
  };
}

/** Star-Index 카드 CLOUD / PM2.5 문구 */
export type StarIndexCardDisplay = {
  cloud: string;
  pm25: string;
};

export function enrichWeatherSnapshotForDisplay(
  snap: WeatherSnapshot,
): WeatherSnapshot {
  const out: WeatherSnapshot = { ...snap };

  let skyCode = out.cloud_sky_code;
  if (skyCode === undefined && out.cloud_cover_pct !== undefined) {
    skyCode = cloudPercentToSkyCode(out.cloud_cover_pct);
  }
  if (skyCode === undefined && out.cloud_score !== undefined) {
    skyCode = cloudPercentToSkyCode(Math.max(0, 100 - out.cloud_score));
  }
  if (skyCode !== undefined) {
    out.cloud_sky_code = skyCode;
    out.cloud_sky_label = skyCodeToLabel(skyCode);
  }

  const pm25 = Number(out.pm25_ug_m3);
  if (Number.isFinite(pm25)) {
    out.pm25_ug_m3 = pm25;
  }

  return out;
}

export function formatCloudDisplay(snap: WeatherSnapshot): string {
  const label = snap.cloud_sky_label?.trim();
  if (label) return label;
  if (snap.cloud_sky_code !== undefined) {
    return skyCodeToLabel(snap.cloud_sky_code);
  }
  if (snap.cloud_cover_pct !== undefined) {
    return skyCodeToLabel(cloudPercentToSkyCode(snap.cloud_cover_pct));
  }
  return skyCodeToLabel(cloudPercentToSkyCode(Math.max(0, 100 - snap.cloud_score)));
}

export function formatPm25Display(snap: WeatherSnapshot): string {
  const station = snap.pm25_station_name?.trim();
  const pm25 = Number(snap.pm25_ug_m3);
  if (Number.isFinite(pm25)) {
    const value =
      Math.abs(pm25 - Math.round(pm25)) < 0.05
        ? `${Math.round(pm25)}`
        : pm25.toFixed(1);
    const core = `${value}㎍/㎥`;
    return station ? `${core}·${station}` : core;
  }
  const grade = snap.pm25_label?.trim();
  if (grade) {
    return station ? `${grade}·${station}` : grade;
  }
  return station ?? '—';
}

export function buildStarIndexCardDisplay(
  snap: WeatherSnapshot,
): StarIndexCardDisplay {
  const enriched = enrichWeatherSnapshotForDisplay(snap);
  return {
    cloud: formatCloudDisplay(enriched),
    pm25: formatPm25Display(enriched),
  };
}
