/** 짧은 시·도 표기 (DB/시드에서 흔히 쓰는 형태) */
const SHORT_PROVINCE = new Set([
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '제주',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
]);

function isProvinceToken(t: string): boolean {
  if (SHORT_PROVINCE.has(t)) return true;
  return /^[가-힣]{2,8}(특별시|광역시|특별자치시|특별자치도|도)$/.test(t);
}

/**
 * 목록·랭킹용: "경남 합천 황매산 …" → 핵심 명칭만 (앞의 시·도 + 시·군·구 1토큰 제거).
 * 패턴이 아니면 원문 유지.
 */
export function spotNameWithoutRegionPrefix(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return full.trim();
  if (!isProvinceToken(parts[0])) return full.trim();
  if (parts.length === 2) return parts[1];
  return parts.slice(2).join(' ') || full.trim();
}

/** 카드 부제: "경기 양평" 등 시·도 + 시·군·구 1토큰 */
export function spotRegionSubtitle(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2 || !isProvinceToken(parts[0])) return '';
  if (parts.length === 2) return parts[0];
  return `${parts[0]} ${parts[1]}`;
}
