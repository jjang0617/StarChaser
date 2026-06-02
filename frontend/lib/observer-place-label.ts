/** 읍·면·리 등 소단위 행정명은 MAIN 상단 위치에서 제외 (시·군·구·동 수준 유지) */
function isSubdistrictToken(token: string): boolean {
  const t = token.trim();
  if (!t) return true;
  return /(읍|면|리)$/.test(t);
}

/**
 * 역지오코딩·명소명 → MAIN용 짧은 위치 (예: "경상남도 합천군 화양읍" → "경상남도 합천군")
 */
export function formatObserverPlaceLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => !isSubdistrictToken(t));
  const base = kept.length > 0 ? kept : tokens;
  return base.slice(0, 3).join(' ');
}

/** expo-location reverseGeocode 결과 → MAIN용 위치 문자열 */
export function placeLabelFromReverseGeocode(addr: {
  region?: string | null;
  city?: string | null;
  subregion?: string | null;
  district?: string | null;
}): string {
  const candidates = [
    addr.region,
    addr.city || addr.subregion,
    addr.district,
  ].filter((x): x is string => Boolean(x && String(x).trim()));

  const uniq: string[] = [];
  for (const p of candidates) {
    const t = p.trim();
    if (!t || uniq.includes(t)) continue;
    if (isSubdistrictToken(t)) continue;
    uniq.push(t);
  }

  return uniq.slice(0, 2).join(' ');
}
