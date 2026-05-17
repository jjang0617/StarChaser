import {
  buildStarIndexCardDisplay,
  enrichWeatherSnapshotForDisplay,
  formatCloudDisplay,
  formatPm25Display,
  normalizeDustCacheEntry,
  normalizeWeatherCacheEntry,
} from './weather-snapshot-display.util';
import type { WeatherSnapshot } from './interfaces/weather-snapshot';

describe('weather-snapshot-display.util', () => {
  it('normalizeWeatherCacheEntry derives skyCode from legacy cloud percent', () => {
    const w = normalizeWeatherCacheEntry({ cloud: 15, humidity: 60 });
    expect(w?.skyCode).toBe(1);
    expect(w?.cloud).toBe(15);
  });

  it('normalizeDustCacheEntry parses numeric pm25', () => {
    const d = normalizeDustCacheEntry({
      pm25: '22',
      pm25Label: '보통',
      stationName: '칠곡군',
    });
    expect(d?.pm25).toBe(22);
  });

  it('formatCloudDisplay uses SKY label not percent', () => {
    const snap: WeatherSnapshot = {
      cloud_score: 85,
      pm25_score: 75,
      light_pollution_score: 50,
      moon_effect_score: 100,
      humidity_score: 80,
      elevation_score: 60,
      wind_score: 90,
      visibility_score: 70,
      temperature_score: 85,
      correction_score: 100,
      cloud_cover_pct: 15,
    };
    expect(formatCloudDisplay(enrichWeatherSnapshotForDisplay(snap))).toBe(
      '맑음',
    );
  });

  it('formatPm25Display prefers concentration over grade', () => {
    const snap: WeatherSnapshot = {
      cloud_score: 85,
      pm25_score: 75,
      light_pollution_score: 50,
      moon_effect_score: 100,
      humidity_score: 80,
      elevation_score: 60,
      wind_score: 90,
      visibility_score: 70,
      temperature_score: 85,
      correction_score: 100,
      pm25_ug_m3: 22,
      pm25_label: '보통',
      pm25_station_name: '칠곡군',
    };
    expect(formatPm25Display(snap)).toBe('22㎍/㎥·칠곡군');
  });

  it('buildStarIndexCardDisplay bundles cloud and pm25 strings', () => {
    const snap: WeatherSnapshot = {
      cloud_score: 35,
      pm25_score: 100,
      light_pollution_score: 50,
      moon_effect_score: 100,
      humidity_score: 80,
      elevation_score: 60,
      wind_score: 90,
      visibility_score: 70,
      temperature_score: 85,
      correction_score: 100,
      cloud_sky_code: 3,
      pm25_ug_m3: 8,
    };
    expect(buildStarIndexCardDisplay(snap)).toEqual({
      cloud: '구름많음',
      pm25: '8㎍/㎥',
    });
  });
});
