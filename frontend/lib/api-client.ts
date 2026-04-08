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
