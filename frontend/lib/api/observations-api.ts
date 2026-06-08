import { getApiBaseUrl } from '../config';
import { prepareImageForUpload, UPLOAD_IMAGE_FORMAT_ERROR } from '../prepare-upload-image';
import {
  clearSession,
  loadTokens,
  setAccessToken,
} from '../auth-storage';
import type { StarIndexResponseDto } from '../types/api';
import {
  ApiRequestError,
  authorizedDeleteJson,
  authorizedGetJson,
  authorizedPostJson,
  clientErrorMessage,
  parseJsonSafe,
  requestAccessRefresh,
  SessionExpiredError,
} from './http';

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
    name: `diary.${ext}`,
    type: prepared.mimeType,
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
      clientErrorMessage(res.status, body, '일기 사진 업로드에 실패했습니다.'),
      res.status,
      body,
    );
  }
  return body as ObservationRowDto;
}

export function deleteObservation(id: string): Promise<{ message: string }> {
  return authorizedDeleteJson<{ message: string }>(`/observations/${id}`);
}

export type ObservationMismatchType = 'felt_score_differs';

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
