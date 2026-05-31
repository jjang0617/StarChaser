import { authorizedGetJson, SessionExpiredError } from './api-client';
import { parseSpotMapLabels } from './spot-map-labels';
import { spotNameWithoutRegionPrefix } from './spot-display-name';
import type { MapSpot } from './types/map-spot';
import type { SpotDto } from './types/api';

export function spotDtoToMapSpot(s: SpotDto): MapSpot {
  const { regionKey, shortTitle } = parseSpotMapLabels(s.name, s.lat, s.lng);
  return {
    id: s.id,
    title: s.name,
    lat: s.lat,
    lng: s.lng,
    regionKey,
    shortTitle,
    markerLabel: spotNameWithoutRegionPrefix(s.name),
  };
}

export async function fetchSpotsAll(): Promise<SpotDto[]> {
  return authorizedGetJson<SpotDto[]>('/spots');
}

/** Star-Index 503이어도 천구용 위경도만 필요할 때 */
export async function fetchSpotById(spotId: string): Promise<SpotDto> {
  const q = encodeURIComponent(spotId);
  return authorizedGetJson<SpotDto>(`/spots/${q}`);
}

export async function fetchSpotsNearby(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<SpotDto[]> {
  const q = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusM: String(radiusM),
  });
  return authorizedGetJson<SpotDto[]>(`/spots/nearby?${q.toString()}`);
}

export { SessionExpiredError };
