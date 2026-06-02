import { getApiBaseUrl } from './config';
import {
  clearSession,
  clearUserScopedStorage,
  loadTokens,
  loadUser,
  setAccessToken,
  type StoredUser,
} from './auth-storage';
import type {
  AuthTokensResponseDto,
  RefreshAccessResponseDto,
  StarIndexResponseDto,
  UserProfileDto,
  WeeklyTop3ItemDto,
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
      messageFromErrorBody(body, `요청 실패 (${res.status})`),
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
      messageFromErrorBody(body, `요청 실패 (${res.status})`),
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
      messageFromErrorBody(body, `요청 실패 (${res.status})`),
      res.status,
      body,
    );
  }
  return body as T;
}

export function fetchMyProfile(): Promise<UserProfileDto> {
  return authorizedGetJson<UserProfileDto>('/users/me');
}

export function updateMyProfile(payload: { nickname: string }): Promise<UserProfileDto> {
  return authorizedPatchJson<UserProfileDto>('/users/me', payload);
}

export async function uploadMyAvatar(
  localUri: string,
  mimeType: string,
): Promise<UserProfileDto> {
  const { accessToken, refreshToken } = await loadTokens();
  if (!accessToken || !refreshToken) {
    throw new SessionExpiredError();
  }

  const ext =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('file', {
    uri: localUri,
    name: `avatar.${ext}`,
    type: mimeType,
  } as unknown as Blob);

  const doFetch = (token: string) =>
    fetch(`${getApiBaseUrl()}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
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
      messageFromErrorBody(body, '프로필 사진 업로드에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as UserProfileDto;
}

export function deleteMyAvatar(): Promise<UserProfileDto> {
  return authorizedDeleteJson<UserProfileDto>('/users/me/avatar');
}

export function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return authorizedPostJson<{ message: string }>('/users/me/password', {
    currentPassword,
    newPassword,
  });
}

/** 회원 탈퇴 — 성공 시 로컬 사용자 캐시·세션 정리 */
export async function deleteMyAccount(
  currentPassword: string,
): Promise<{ message: string }> {
  const user = await loadUser();
  let result: { message: string };
  try {
    result = await authorizedDeleteJson<{ message: string }>('/users/me', {
      currentPassword,
    });
  } catch (e) {
    if (e instanceof ApiRequestError) {
      throw new ApiRequestError(
        messageFromErrorBody(e.body, '회원 탈퇴에 실패했습니다.'),
        e.status,
        e.body,
      );
    }
    throw e;
  }
  if (user?.id) {
    await clearUserScopedStorage(user.id);
  }
  await clearSession();
  return result;
}

export async function postAuthJson(
  path: '/auth/login' | '/auth/register',
  payload:
    | { email: string; password: string }
    | { email: string; password: string; nickname: string; verificationCode: string },
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

export async function checkEmail(email: string): Promise<{ available: boolean }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      messageFromErrorBody(body, '이메일 확인에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { available: boolean };
}

export async function findEmailByNickname(
  nickname: string,
): Promise<{ maskedEmail: string }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/find-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      messageFromErrorBody(body, '이메일 찾기에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { maskedEmail: string };
}

export async function checkNickname(nickname: string): Promise<{ available: boolean }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/check-nickname`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      messageFromErrorBody(body, '닉네임 확인에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { available: boolean };
}

export async function sendVerificationCode(
  email: string,
  purpose: 'register' | 'reset-password',
): Promise<{ message: string }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      messageFromErrorBody(body, '인증번호 발송에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { message: string };
}

export async function verifyCode(
  email: string,
  code: string,
  purpose: 'register' | 'reset-password',
): Promise<{ verified: boolean }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, purpose }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      messageFromErrorBody(body, '인증번호 확인에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { verified: boolean };
}

export async function resetPassword(
  email: string,
  verificationCode: string,
  password: string,
): Promise<{ message: string }> {
  const res = await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, verificationCode, password }),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiRequestError(
      messageFromErrorBody(body, '비밀번호 변경에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as { message: string };
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

export function fetchWeeklyTop3(weekStart?: string): Promise<WeeklyTop3ItemDto[]> {
  const q = new URLSearchParams();
  if (weekStart && weekStart.trim() !== '') q.set('weekStart', weekStart.trim());
  const suffix = q.size ? `?${q.toString()}` : '';
  return authorizedGetJson<WeeklyTop3ItemDto[]>(`/top3/weekly${suffix}`);
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

export interface CorrectionAggregateDto {
  spotId: string;
  submissionCount: number;
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

export interface ObservationPhotoDto {
  id: string;
  imageUrl: string;
}

export interface ObservationRowDto {
  id: string;
  userId: string;
  spotId: string | null;
  starIndexVal: number;
  weatherSnapshot: StarIndexResponseDto['weatherSnapshot'];
  result: 'success' | 'partial' | 'fail';
  title: string | null;
  content: string | null;
  placeLabel: string | null;
  observedAt: string;
  photos: ObservationPhotoDto[];
}

export function fetchMyObservations(): Promise<ObservationRowDto[]> {
  return authorizedGetJson<ObservationRowDto[]>('/observations/me');
}

export interface CreateObservationPayload {
  spotId?: string;
  starIndexVal: number;
  weatherSnapshot: Record<string, unknown>;
  result: 'success' | 'partial' | 'fail';
  title?: string;
  content?: string;
  placeLabel?: string;
}

export function createObservation(
  payload: CreateObservationPayload,
): Promise<ObservationRowDto> {
  return authorizedPostJson<ObservationRowDto>('/observations', payload);
}

export async function uploadObservationPhoto(
  observationId: string,
  localUri: string,
  mimeType: string,
): Promise<ObservationRowDto> {
  const { accessToken, refreshToken } = await loadTokens();
  if (!accessToken || !refreshToken) {
    throw new SessionExpiredError();
  }

  const ext =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('file', {
    uri: localUri,
    name: `diary.${ext}`,
    type: mimeType,
  } as unknown as Blob);

  const path = `/observations/${observationId}/photos`;
  const doFetch = (token: string) =>
    fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
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
      messageFromErrorBody(body, '일기 사진 업로드에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as ObservationRowDto;
}

export function deleteObservation(id: string): Promise<{ message: string }> {
  return authorizedDeleteJson<{ message: string }>(`/observations/${id}`);
}

export type ObservationMismatchType =
  | 'unmeasurable_but_success'
  | 'high_score_but_fail';

export interface ObservationReportStatusDto {
  submitted: boolean;
  status?: 'pending' | 'reviewed';
  createdAt?: string;
}

export function fetchObservationReportStatus(
  observationId: string,
): Promise<ObservationReportStatusDto> {
  return authorizedGetJson<ObservationReportStatusDto>(
    `/observation-reports/status/${observationId}`,
  );
}

export interface SubmitObservationReportPayload {
  observationId: string;
  mismatchType: ObservationMismatchType;
  message?: string;
}

export function submitObservationMismatchReport(
  payload: SubmitObservationReportPayload,
): Promise<{ id: string; status: string; createdAt: string }> {
  return authorizedPostJson('/observation-reports', payload);
}

export interface SubmitSpotReportPayload {
  message: string;
  lat: number;
  lng: number;
}

export function submitSpotReport(
  payload: SubmitSpotReportPayload,
): Promise<{ id: string; starIndexVal: number; latitude: number; longitude: number; createdAt: string }> {
  return authorizedPostJson('/spot-reports', payload);
}
