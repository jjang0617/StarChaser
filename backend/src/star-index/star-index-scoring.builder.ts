import { MOON_ALTITUDE_MISSING_SENTINEL } from '../sky/kasi.mapper';
import { sunAltitudeAtObserver } from '../sky/sun-ephemeris.util';
import { sunAltitudeToObservationScore } from './sun-observation-score.util';
import {
  aggregateStarIndexScore,
  calcCloudScore,
  calcElevationScore,
  calcHumidityHazeScore,
  calcLightPollutionScore,
  calcMoonEffectScore,
  calcPm25Score,
  calcPrecipitationScore,
  calcTemperatureNeutralScore,
  calcVisibilityScore,
  calcWindSeeingScore,
} from './star-index-scoring.util';
import { skyCodeToLabel } from '../cache-hydration/kma-forecast.util';
import type { WeatherSnapshot } from '../common/interfaces/weather-snapshot';
import { normalizeWeatherSnapshotForStorage } from '../common/interfaces/weather-snapshot';
import { enrichWeatherSnapshotForDisplay } from '../common/weather-snapshot-display.util';
import type { StarIndexCachePayload, StarIndexInput } from './star-index.types';

export function buildRawWeatherSnapshot(input: StarIndexInput): WeatherSnapshot {
  const { weather, dust, moon, bortleClass, elevationM, lat, lng } = input;
  const skyCode = weather.skyCode;
  const sunAltDeg = sunAltitudeAtObserver(lat, lng, input.atUtc ?? new Date());
  const precipScore = calcPrecipitationScore(weather.pty, weather.pop);

  return {
    cloud_score: calcCloudScore(weather.cloud),
    pm25_score: calcPm25Score(dust.pm25),
    light_pollution_score: calcLightPollutionScore(bortleClass),
    moon_effect_score: calcMoonEffectScore(
      moon.phase,
      moon.altitude,
      moon.moonAltitudeKnown,
      MOON_ALTITUDE_MISSING_SENTINEL,
    ),
    humidity_score: calcHumidityHazeScore(weather.humidity, dust.pm25),
    elevation_score: calcElevationScore(elevationM),
    wind_score: calcWindSeeingScore(weather.windSpeed),
    visibility_score: calcVisibilityScore(
      weather.visibility,
      weather.visibilityKnown,
    ),
    temperature_score: calcTemperatureNeutralScore(),
    correction_score: input.correctionScore ?? 100,
    precipitation_probability: weather.pop,
    precipitation_type: weather.pty,
    precipitation_score: precipScore,
    visibility_known: weather.visibilityKnown,
    moon_altitude_deg: moon.altitude,
    moon_altitude_known: moon.moonAltitudeKnown,
    lun_phase: moon.phase,
    cloud_sky_code: skyCode,
    cloud_sky_label: skyCodeToLabel(skyCode),
    cloud_cover_pct: weather.cloud,
    pm25_ug_m3: dust.pm25,
    pm25_label: dust.pm25Label,
    pm25_station_name: dust.stationName,
    sun_altitude_deg: sunAltDeg,
    daylight_observation_score: sunAltitudeToObservationScore(sunAltDeg),
  };
}

export function calcStarIndexWithSnapshot(
  input: StarIndexInput,
): StarIndexCachePayload {
  const raw = buildRawWeatherSnapshot(input);
  const weatherSnapshot = enrichWeatherSnapshotForDisplay(
    normalizeWeatherSnapshotForStorage(raw),
  );
  const sunAltDeg = sunAltitudeAtObserver(
    input.lat,
    input.lng,
    input.atUtc ?? new Date(),
  );
  const score = aggregateStarIndexScore({
    components: weatherSnapshot,
    cloudPercent: input.weather.cloud,
    sunAltitudeDeg: sunAltDeg,
    pop: input.weather.pop,
    pty: input.weather.pty,
    visibilityKnown: input.weather.visibilityKnown,
  });
  return { score, weatherSnapshot };
}

export function calcStarIndex(input: StarIndexInput): number {
  return calcStarIndexWithSnapshot(input).score;
}

export function recalcScoreFromWeatherSnapshot(
  snapshot: WeatherSnapshot,
  lat: number,
  lng: number,
  atUtc?: Date,
): number {
  const sunAltDeg = sunAltitudeAtObserver(lat, lng, atUtc ?? new Date());
  const cloudPercent =
    snapshot.cloud_cover_pct ??
    Math.min(100, Math.max(0, 100 - Math.round(snapshot.cloud_score)));
  return aggregateStarIndexScore({
    components: snapshot,
    cloudPercent,
    sunAltitudeDeg: sunAltDeg,
    pop: snapshot.precipitation_probability ?? 0,
    pty: snapshot.precipitation_type ?? 0,
    visibilityKnown: snapshot.visibility_known === true,
  });
}
