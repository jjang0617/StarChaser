import type { StarIndexResponseDto } from '../types/api';
import { authorizedGetJson } from './http';

export function fetchStarIndex(spotId: string): Promise<StarIndexResponseDto> {
  const q = encodeURIComponent(spotId);
  return authorizedGetJson<StarIndexResponseDto>(`/star-index?spotId=${q}`);
}

/** JWT 필요. 기상은 lat·lng 격자, Bortle/고도는 (가능 시) 가장 가까운 명소 참고 */
export function fetchStarIndexAtLocation(
  lat: number,
  lng: number,
  atIso?: string,
): Promise<StarIndexResponseDto> {
  const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (atIso?.trim()) q.set('at', atIso.trim());
  return authorizedGetJson<StarIndexResponseDto>(`/star-index?${q.toString()}`);
}

/** 지도 클러스터 시트 — 등록된 명소 N곳의 점수(요청 1회) */
export function fetchStarIndexSpotScores(
  spotIds: string[],
): Promise<{ spotId: string; score: number }[]> {
  const ids = spotIds
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
  if (ids.length === 0) return Promise.resolve([]);
  const q = encodeURIComponent(ids.join(','));
  return authorizedGetJson<{ items: { spotId: string; score: number }[] }>(
    `/star-index/spot-scores?ids=${q}`,
  ).then((r) => r.items ?? []);
}
