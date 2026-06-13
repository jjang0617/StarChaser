import { ApiRequestError, SessionExpiredError } from './api-client';
import { sanitizeApiErrorMessage } from './sanitize-api-error';

/** API 실패 메시지 — SessionExpired는 null (호출부에서 세션 처리) */
export function apiErrorMessage(
  e: unknown,
  fallback: string,
): string | null {
  if (e instanceof SessionExpiredError) return null;
  if (e instanceof ApiRequestError) {
    return sanitizeApiErrorMessage(e.status, e.message);
  }
  return fallback;
}

export async function handleSessionExpired(
  e: unknown,
  onSessionInvalidated: () => void | Promise<void>,
): Promise<boolean> {
  if (!(e instanceof SessionExpiredError)) return false;
  await onSessionInvalidated();
  return true;
}
