import { authorizedGetJson } from './http';

export interface SkyStarDto {
  id: string;
  raDeg: number;
  decDeg: number;
  mag: number;
}

export interface SkyStarsMvpResponseDto {
  stars: SkyStarDto[];
}

export function fetchSkyStarsMvp(): Promise<SkyStarsMvpResponseDto> {
  return authorizedGetJson<SkyStarsMvpResponseDto>('/sky/stars');
}

export interface SkyViewStarDto {
  hip: number;
  name: string | null;
  con: string;
  raDeg: number;
  decDeg: number;
  mag: number;
  altDeg: number;
  azDeg: number;
  visible: boolean;
  /** 지구까지 거리(광년) — 서버 카탈로그에 없으면 null */
  distanceLy?: number | null;
}

export interface SkyViewConstellationLabelDto {
  con: string;
  altDeg: number;
  azDeg: number;
}

export interface SkyViewBodyDto {
  id: 'moon' | 'venus' | 'jupiter';
  labelKo: string;
  azDeg: number;
  altDeg: number;
  magnitude: number;
  visible: boolean;
  phaseFraction?: number;
  moonPhaseDeg?: number;
}

export interface SkyViewResponseDto {
  at: string;
  lat: number;
  lng: number;
  jd: number;
  lstDeg: number;
  stars: SkyViewStarDto[];
  constellationLabels: SkyViewConstellationLabelDto[];
  /** 없으면 구 서버 응답 — 빈 배열로 처리 */
  bodies?: SkyViewBodyDto[];
  ephemerisSource?: string;
}

export function fetchSkyView(params: {
  lat: number;
  lng: number;
  at?: string;
}): Promise<SkyViewResponseDto> {
  const q = new URLSearchParams();
  q.set('lat', String(params.lat));
  q.set('lng', String(params.lng));
  if (params.at) q.set('at', params.at);
  return authorizedGetJson<SkyViewResponseDto>(`/sky/view?${q.toString()}`);
}

export interface ConstellationLineSegmentDto {
  fromHip: number;
  toHip: number;
  con: string;
}

export interface ConstellationLinesResponseDto {
  epoch: string;
  note?: string;
  segments: ConstellationLineSegmentDto[];
}

export function fetchConstellationLines(): Promise<ConstellationLinesResponseDto> {
  return authorizedGetJson<ConstellationLinesResponseDto>(
    '/sky/constellation-lines',
  );
}
