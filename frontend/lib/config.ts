/**
 * API 베이스 URL — 코드에 시크릿 금지, Expo public env만 사용 (.cursorrules)
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!url) {
    return 'http://127.0.0.1:3333';
  }
  return url.replace(/\/$/, '');
}

/** Star-Index 데모용 명소 UUID — 없으면 카드에 설정 안내 */
export function getDefaultSpotId(): string | undefined {
  const id = process.env.EXPO_PUBLIC_DEFAULT_SPOT_ID?.trim();
  return id || undefined;
}
