/** 로컬(@앞) 길이에 비례해 앞부분 노출 — 최소 2자, 최대 8자 + ***@도메인 */
function visibleLocalLength(localLength: number): number {
  if (localLength <= 1) return localLength;
  if (localLength <= 3) return 2;
  return Math.min(8, Math.max(3, Math.ceil(localLength * 0.5)));
}

/** 로그인 이메일 마스킹 */
export function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf('@');
  if (at <= 0) return '***@***';
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) return '***@***';

  const n = visibleLocalLength(local.length);
  const visible = local.slice(0, n);
  return `${visible}***@${domain}`;
}
