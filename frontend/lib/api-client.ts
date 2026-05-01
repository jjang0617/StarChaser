import { getApiBaseUrl } from './config';
import {
  clearSession,
  loadTokens,
  loadUser,
  setAccessToken,
  type StoredUser,
} from './auth-storage';
import type {
  AuthTokensResponseDto,
  RefreshAccessResponseDto,
  StarIndexResponseDto,
} from './types/api';
import { isAccessTokenExpired } from './jwt-utils';

export class SessionExpiredError extends Error {
  constructor(message = '세션이 만료되었습니다. 다시 로그인해 주세요.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Nest validation pipe — message가 string | string[] */
function messageFromErrorBody(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return fallback;
  }
  const m = (body as { message: unknown }).message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.map(String).join(' ');
  return fallback;
}

/** refresh로 access만 재발급 */
export async function requestAccessRefresh(
  refreshToken: string,
): Promise<string> {
  const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      messageFromErrorBody(body, '토큰 갱신 실패'),
      res.status,
      body,
    );
  }
  const data = body as RefreshAccessResponseDto;
  if (!data?.accessToken) {
    throw new ApiRequestError('응답에 accessToken이 없습니다.', res.status, body);
  }
  return data.accessToken;
}

/**
 * Bearer가 필요한 GET — 401 시 refresh 1회 후 재시도, 실패 시 세션 삭제
 */
export async function authorizedGetJson<T>(path: string): Promise<T> {
  const { accessToken, refreshToken } = await loadTokens();
  if (!accessToken || !refreshToken) {
    throw new SessionExpiredError();
  }

  const doFetch = (token: string) =>
    fetch(`${getApiBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

  let res = await doFetch(accessToken);
  if (res.status === 401) {
    try {
      const next = await requestAccessRefresh(refreshToken);
      await setAccessToken(next);
      res = await doFetch(next);
    } catch {
      await clearSession();
      throw new SessionExpiredError();
    }
  }

  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      messageFromErrorBody(body, `요청 실패 (${res.status})`),
      res.status,
      body,
    );
  }
  return body as T;
}

/**
 * Bearer가 필요한 POST JSON — 401 시 refresh 1회 후 재시도
 */
export async function authorizedPostJson<T>(
  path: string,
  payload: unknown,
): Promise<T> {
  const { accessToken, refreshToken } = await loadTokens();
  if (!accessToken || !refreshToken) {
    throw new SessionExpiredError();
  }

  const doFetch = (token: string) =>
    fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

  let res = await doFetch(accessToken);
  if (res.status === 401) {
    try {
      const next = await requestAccessRefresh(refreshToken);
      await setAccessToken(next);
      res = await doFetch(next);
    } catch {
      await clearSession();
      throw new SessionExpiredError();
    }
  }

  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      messageFromErrorBody(body, `요청 실패 (${res.status})`),
      res.status,
      body,
    );
  }
  return body as T;
}

export async function postAuthJson(
  path: '/auth/login' | '/auth/register',
  payload: { email: string; password: string },
): Promise<AuthTokensResponseDto> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    const fallback =
      path === '/auth/register'
        ? '회원가입에 실패했습니다.'
        : '로그인에 실패했습니다.';
    throw new ApiRequestError(
      messageFromErrorBody(body, fallback),
      res.status,
      body,
    );
  }
  const data = body as AuthTokensResponseDto;
  if (!data.accessToken || !data.refreshToken || !data.user) {
    throw new ApiRequestError('인증 응답 형식이 올바르지 않습니다.', res.status, body);
  }
  return data;
}

/** 앱 기동 시 access 만료면 선제 갱신 */
export async function ensureFreshAccessToken(): Promise<{
  accessToken: string;
  refreshToken: string;
  user: StoredUser | null;
} | null> {
  const { accessToken, refreshToken } = await loadTokens();
  if (!refreshToken) return null;

  const user = await loadUser();

  let access = accessToken;
  if (!access || isAccessTokenExpired(access)) {
    try {
      access = await requestAccessRefresh(refreshToken);
      await setAccessToken(access);
    } catch {
      await clearSession();
      return null;
    }
  }

  return { accessToken: access, refreshToken, user };
}

export function fetchStarIndex(spotId: string): Promise<StarIndexResponseDto> {
  const q = encodeURIComponent(spotId);
  return authorizedGetJson<StarIndexResponseDto>(`/star-index?spotId=${q}`);
}

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
}

export interface SkyViewConstellationLabelDto {
  con: string;
  altDeg: number;
  azDeg: number;
}

export interface SkyViewResponseDto {
  at: string;
  lat: number;
  lng: number;
  jd: number;
  lstDeg: number;
  stars: SkyViewStarDto[];
  constellationLabels: SkyViewConstellationLabelDto[];
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

export interface CorrectionAggregateDto {
  spotId: string;
  submissionCount: number;
  aggregatedCorrectionScore: number;
}

export function fetchCorrectionAggregate(
  spotId: string,
): Promise<CorrectionAggregateDto> {
  const q = encodeURIComponent(spotId);
  return authorizedGetJson<CorrectionAggregateDto>(
    `/corrections/aggregate?spotId=${q}`,
  );
}

export interface CreateCorrectionPayload {
  spotId: string;
  perceivedQuality: number;
}

export interface CreateCorrectionResponseDto {
  id: string;
  spotId: string;
  perceivedQuality: number;
  createdAt: string;
  aggregatedCorrectionScore: number;
}

export function submitStarIndexCorrection(
  payload: CreateCorrectionPayload,
): Promise<CreateCorrectionResponseDto> {
  return authorizedPostJson<CreateCorrectionResponseDto>(
    '/corrections',
    payload,
  );
}

export interface ObservationRowDto {
  id: string;
  userId: string;
  spotId: string | null;
  starIndexVal: number;
  weatherSnapshot: StarIndexResponseDto['weatherSnapshot'];
  result: 'success' | 'partial' | 'fail';
  observedAt: string;
}

export function fetchMyObservations(): Promise<ObservationRowDto[]> {
  return authorizedGetJson<ObservationRowDto[]>('/observations/me');
}

export interface CreateObservationPayload {
  spotId?: string;
  starIndexVal: number;
  weatherSnapshot: Record<string, unknown>;
  result: 'success' | 'partial' | 'fail';
}

export function createObservation(
  payload: CreateObservationPayload,
): Promise<ObservationRowDto> {
  return authorizedPostJson<ObservationRowDto>('/observations', payload);
}
