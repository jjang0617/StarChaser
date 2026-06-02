/** 짧은 시·도 표기 */
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

/** 주소·장소명 매칭용 시·도 별칭 */
export const PROVINCE_ADDRESS_ALIASES: Record<string, readonly string[]> = {
  서울: ['서울', '서울특별시'],
  부산: ['부산', '부산광역시'],
  대구: ['대구', '대구광역시'],
  인천: ['인천', '인천광역시'],
  광주: ['광주', '광주광역시'],
  대전: ['대전', '대전광역시'],
  울산: ['울산', '울산광역시'],
  세종: ['세종', '세종특별자치시'],
  제주: ['제주', '제주도', '제주특별자치도'],
  경기: ['경기', '경기도'],
  강원: ['강원', '강원도', '강원특별자치도'],
  충북: ['충북', '충청북도'],
  충남: ['충남', '충청남도'],
  전북: ['전북', '전라북도', '전북특별자치도'],
  전남: ['전남', '전라남도'],
  경북: ['경북', '경상북도'],
  경남: ['경남', '경상남도'],
};

export function normalizePlaceSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

export function isProvinceToken(t: string): boolean {
  const s = t.trim();
  if (SHORT_PROVINCE.has(s)) return true;
  return /^[가-힣]{2,12}(특별시|광역시|특별자치시|특별자치도|도)$/.test(s);
}

/** "강원특별자치도" → "강원" */
export function normalizeProvinceToken(token: string): string | null {
  const s = token.trim();
  if (SHORT_PROVINCE.has(s)) return s;
  for (const short of SHORT_PROVINCE) {
    if (s.startsWith(short)) return short;
  }
  const m = s.match(/^([가-힣]{2,4})(특별시|광역시|특별자치시|특별자치도|도)$/);
  if (m && SHORT_PROVINCE.has(m[1])) return m[1];
  return null;
}

export function provinceTokenFromQuery(query: string): string | null {
  const parts = normalizePlaceSearchQuery(query).split(/\s+/).filter(Boolean);
  for (const p of parts) {
    const n = normalizeProvinceToken(p);
    if (n) return n;
  }
  return null;
}

export function textMatchesProvince(text: string, provinceToken: string): boolean {
  const hay = text.toLowerCase();
  const aliases = PROVINCE_ADDRESS_ALIASES[provinceToken] ?? [provinceToken];
  return aliases.some((a) => hay.includes(a.toLowerCase()));
}

/** "평창군" → "평창", "성산읍" → "성산" */
export function localityCoreToken(token: string): string {
  return token
    .trim()
    .replace(/(특별자치도|특별시|광역시|도|시|군|구|읍|면|동|리|가|로)$/g, '')
    .trim();
}

export function localityTokensFromQuery(query: string): string[] {
  const province = provinceTokenFromQuery(query);
  const parts = normalizePlaceSearchQuery(query).split(/\s+/).filter(Boolean);
  const cores = new Set<string>();

  for (const p of parts) {
    if (normalizeProvinceToken(p)) continue;
    const core = localityCoreToken(p);
    if (core.length >= 2) cores.add(core.toLowerCase());
  }

  if (province) {
    const withoutProvince = parts
      .filter((p) => !normalizeProvinceToken(p))
      .join(' ');
    const joinedCore = localityCoreToken(withoutProvince);
    if (joinedCore.length >= 2) cores.add(joinedCore.toLowerCase());
  }

  return [...cores];
}

export function textMatchesLocalityCore(text: string, core: string): boolean {
  if (!core || core.length < 2) return false;
  const hay = text.toLowerCase();
  if (hay.includes(core)) return true;
  return hay.includes(`${core}군`) || hay.includes(`${core}시`) || hay.includes(`${core}읍`);
}

/**
 * 검색에 사용할 쿼리 목록 (원문 우선, 중복 제거).
 * 여러 단어·시도가 포함되면 보조 쿼리도 항상 시도한다.
 */
export function buildPlaceSearchQueries(query: string): string[] {
  const q = normalizePlaceSearchQuery(query);
  if (!q) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = normalizePlaceSearchQuery(s);
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  push(q);
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return out;

  const provinceIdx = parts.findIndex((p) => normalizeProvinceToken(p) != null);
  if (provinceIdx >= 0) {
    const rest = parts.filter((_, i) => i !== provinceIdx).join(' ');
    push(rest);
  }

  for (let i = 0; i < parts.length; i += 1) {
    const core = localityCoreToken(parts[i]);
    if (core.length >= 2) push(core);
  }

  if (parts.length >= 2) {
    push(parts.slice(-2).join(' '));
    push(parts[parts.length - 1]);
  }

  if (parts.length >= 3) {
    push(parts.slice(1).join(' '));
  }

  return out;
}
