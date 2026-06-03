import type { WeatherSnapshot } from '../common/interfaces/weather-snapshot';

export interface WeatherData {
  skyCode: number;
  cloud: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  visibilityKnown: boolean;
  temperature: number;
  pop: number;
  pty: number;
}

export interface DustData {
  pm25: number;
  pm25Label?: string;
  stationName?: string;
}

export interface MoonData {
  phase: number;
  altitude: number;
  moonAltitudeKnown?: boolean;
}

export interface StarIndexInput {
  weather: WeatherData;
  dust: DustData;
  moon: MoonData;
  bortleClass: number;
  elevationM: number;
  lat: number;
  lng: number;
  atUtc?: Date;
  correctionScore?: number;
}

export type StarIndexCachePayload = {
  score: number;
  weatherSnapshot: WeatherSnapshot;
  cachedAt?: string;
};

export type StarIndexFromCacheResult = {
  score: number;
  weatherSnapshot: WeatherSnapshot;
  cacheKeys: { weatherKey: string; dustKey: string; moonKey: string };
  isStale?: boolean;
  cachedAt?: string;
};

export const GPS_NEAREST_SPOT_RADIUS_M = 200_000;
