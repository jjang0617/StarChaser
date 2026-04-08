/**
 * JWT payload 파싱 — exp·email 등 (서명 검증 없음, 만료 판단·표시용)
 */
export function getJwtPayload(jwt: string): {
  sub?: string;
  email?: string;
  exp?: number;
} | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (b64.length % 4)) % 4;
    const padded = b64 + '='.repeat(pad);
    if (typeof atob !== 'function') return null;
    const binary = atob(padded);
    const json = decodeURIComponent(
      Array.from(binary, (c) => {
        const code = c.charCodeAt(0);
        return `%${code < 16 ? '0' : ''}${code.toString(16)}`;
      }).join(''),
    );
    const payload = JSON.parse(json) as {
      sub?: string;
      email?: string;
      exp?: number;
    };
    return payload;
  } catch {
    return null;
  }
}

export function getJwtExpSeconds(jwt: string): number | null {
  const p = getJwtPayload(jwt);
  return typeof p?.exp === 'number' ? p.exp : null;
}

/** true면 곧 만료 또는 이미 만료 — skew 초 만큼 여유 */
export function isAccessTokenExpired(jwt: string, skewSeconds = 60): boolean {
  const exp = getJwtExpSeconds(jwt);
  if (exp === null) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + skewSeconds;
}
