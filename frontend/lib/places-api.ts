import { authorizedGetJson, SessionExpiredError } from './api-client';

export type PlaceSearchItem = {
  lat: number;
  lng: number;
  name: string;
  address: string;
};

export async function fetchPlacesSearch(
  keyword: string,
  limit = 10,
): Promise<PlaceSearchItem[]> {
  const q = new URLSearchParams({
    q: keyword.trim(),
    limit: String(Math.max(1, Math.min(limit, 15))),
  });
  return authorizedGetJson<PlaceSearchItem[]>(`/places/search?${q.toString()}`);
}

export { SessionExpiredError };
