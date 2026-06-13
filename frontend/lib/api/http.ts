import { getApiBaseUrl } from '../config';
import {
  clearSession,
  loadTokens,
  setAccessToken,
  loadUser,
  type StoredUser,
} from '../auth-storage';
import type { RefreshAccessResponseDto } from '../types/api';
import { isAccessTokenExpired } from '../jwt-utils';
import { sanitizeApiErrorMessage } from '../sanitize-api-error';

export function clientErrorMessage(
  status: number,
  body: unknown,
  fallback: string,
): string {
  return sanitizeApiErrorMessage(status, messageFromErrorBody(body, fallback));
}

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

export async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Nest validation pipe — message가 string | string[] */
export function messageFromErrorBody(body: unknown, fallback: string): string {
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
      clientErrorMessage(res.status, body, '토큰 갱신 실패'),
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
      clientErrorMessage(res.status, body, `요청 실패 (${res.status})`),
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
      clientErrorMessage(res.status, body, `요청 실패 (${res.status})`),
      res.status,
      body,
    );
  }
  return body as T;
}

/**
 * Bearer가 필요한 PUT JSON — 401 시 refresh 1회 후 재시도
 */
export async function authorizedPutJson<T>(
  path: string,
  payload: unknown,
): Promise<T> {
  const { accessToken, refreshToken } = await loadTokens();
  if (!accessToken || !refreshToken) {
    throw new SessionExpiredError();
  }

  const doFetch = (token: string) =>
    fetch(`${getApiBaseUrl()}${path}`, {
      method: 'PUT',
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
      clientErrorMessage(res.status, body, `요청 실패 (${res.status})`),
      res.status,
      body,
    );
  }
  return body as T;
}

/** Bearer가 필요한 PATCH JSON */
export async function authorizedPatchJson<T>(
  path: string,
  payload: unknown,
): Promise<T> {
  const { accessToken, refreshToken } = await loadTokens();
  if (!accessToken || !refreshToken) {
    throw new SessionExpiredError();
  }

  const doFetch = (token: string) =>
    fetch(`${getApiBaseUrl()}${path}`, {
      method: 'PATCH',
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
      clientErrorMessage(res.status, body, `요청 실패 (${res.status})`),
      res.status,
      body,
    );
  }
  return body as T;
}

/** Bearer가 필요한 DELETE (선택적 JSON body) */
export async function authorizedDeleteJson<T>(
  path: string,
  payload?: unknown,
): Promise<T> {
  const { accessToken, refreshToken } = await loadTokens();
  if (!accessToken || !refreshToken) {
    throw new SessionExpiredError();
  }

  const doFetch = (token: string) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const init: RequestInit = { method: 'DELETE', headers };
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(payload);
    }
    return fetch(`${getApiBaseUrl()}${path}`, init);
  };

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
      clientErrorMessage(res.status, body, `요청 실패 (${res.status})`),
      res.status,
      body,
    );
  }
  return body as T;
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
