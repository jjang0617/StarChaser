import { authorizedGetJson, SessionExpiredError } from './api-client';
import type { MapSpot } from './types/map-spot';
import type { SpotDto } from './types/api';

export function spotDtoToMapSpot(s: SpotDto): MapSpot {
  return { id: s.id, title: s.name, lat: s.lat, lng: s.lng };
}

export async function fetchSpotsAll(): Promise<SpotDto[]> {
  return authorizedGetJson<SpotDto[]>('/spots');
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
