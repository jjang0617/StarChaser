import { getApiBaseUrl } from '../config';
import { prepareImageForUpload, UPLOAD_IMAGE_FORMAT_ERROR } from '../prepare-upload-image';
import {
  clearSession,
  clearUserScopedStorage,
  loadTokens,
  loadUser,
  setAccessToken,
} from '../auth-storage';
import type { UserProfileDto } from '../types/api';
import {
  ApiRequestError,
  authorizedDeleteJson,
  authorizedGetJson,
  authorizedPatchJson,
  authorizedPostJson,
  clientErrorMessage,
  parseJsonSafe,
  requestAccessRefresh,
  SessionExpiredError,
} from './http';

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

  let prepared;
  try {
    prepared = await prepareImageForUpload(localUri, mimeType);
  } catch {
    throw new ApiRequestError(UPLOAD_IMAGE_FORMAT_ERROR, 400, null);
  }

  const ext =
    prepared.mimeType === 'image/png'
      ? 'png'
      : prepared.mimeType === 'image/webp'
        ? 'webp'
        : 'jpg';
  const form = new FormData();
  form.append('file', {
    uri: prepared.uri,
    name: `avatar.${ext}`,
    type: prepared.mimeType,
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
      clientErrorMessage(res.status, body, '프로필 사진 업로드에 실패했습니다.'),
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
        clientErrorMessage(e.status, e.body, '회원 탈퇴에 실패했습니다.'),
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
