/**
 * 클라이언트(JSON) 응답용 메시지 — 내부 키·env·스키마명 노출 방지
 */
const INTERNAL_PATTERNS =
  /spotId|spot not found|cache_|weather_snapshot|JWT_|API_KEY|FIREBASE_|ADMIN_EMAILS|refresh token|access token|must not|should not exist|uuid v|property \w+ should|invalid (west|south|north|east)|upstream_failed|KMA_|AIRKOREA_/i;

export function sanitizeClientErrorMessage(
  status: number,
  raw: string | string[] | undefined,
): string {
  const text = Array.isArray(raw)
    ? raw.map(String).join(' ')
    : typeof raw === 'string'
      ? raw.trim()
      : '';

  if (status >= 500) {
    return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (status === 503) {
    return '서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (status === 429) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (!text) {
    if (status === 400) return '요청 형식이 올바르지 않습니다.';
    if (status === 401) return '인증이 필요합니다. 다시 로그인해 주세요.';
    if (status === 403) return '이 작업을 수행할 권한이 없습니다.';
    if (status === 404) return '요청한 정보를 찾을 수 없습니다.';
    return '요청을 처리할 수 없습니다.';
  }

  if (INTERNAL_PATTERNS.test(text)) {
    if (status === 400) return '요청 형식이 올바르지 않습니다.';
    if (status === 401) return '세션이 만료되었습니다. 다시 로그인해 주세요.';
    if (status === 403) return '이 작업을 수행할 권한이 없습니다.';
    if (status === 404) return '요청한 정보를 찾을 수 없습니다.';
    return '요청을 처리할 수 없습니다.';
  }

  return text;
}
