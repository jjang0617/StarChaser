/**
 * 명소 이름에서 지도 클러스터용 광역 키·짧은 라벨 추출.
 * 시드 형식: "경북 영천 보현산천문대", "강원 영월 별마로 천문대" 등
 */

/** 이름 첫 토큰이 이 집합이면 시·도 단위 클러스터 키로 사용 */
const PROVINCE_FIRST_TOKEN = new Set([
  '경기',
  '강원',
  '경북',
  '경남',
  '전북',
  '전남',
  '충북',
  '충남',
  '제주',
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
]);

/** 시·군 첫 토큰 → 도 (시드에 도 접두가 없을 때·DB 구이름 대비) */
const COUNTY_FIRST_TO_PROVINCE: Record<string, string> = {
  영월: '강원',
  인제: '강원',
  태백: '강원',
  화천: '강원',
  정선: '강원',
  평창: '강원',
  홍천: '강원',
  양구: '강원',
  삼척: '강원',
  속초: '강원',
  양양: '강원',
  영천: '경북',
  영양: '경북',
  봉화: '경북',
  울진: '경북',
  청송: '경북',
  단양: '충북',
  괴산: '충북',
  태안: '충남',
  청양: '충남',
  보령: '충남',
  무주: '전북',
  신안: '전남',
  구례: '전남',
  고흥: '전남',
  장흥: '전남',
  합천: '경남',
  산청: '경남',
};

/**
 * 대한민국 대략 구역(위경도 박스) — 첫 토큰이 도 이름이 아닐 때 보조.
 * 경계는 근사치(MVP).
 */
export function guessRegionKeyFromLatLng(lat: number, lng: number): string {
  if (lat < 33.0 || lat > 38.7 || lng < 124.0 || lng > 132.5) {
    return '기타';
  }
  if (lat >= 33.0 && lat < 34.5 && lng < 127.0) return '제주';
  if (lng < 126.2) return '전라';
  // 강원 (영월 별마로 lat≈37.20 — 이전 37.2 하한 때문에 '기타' 되던 구간 포함)
  if (lat >= 37.0 && lat < 38.7 && lng >= 127.0 && lng < 129.7) return '강원';
  if (lat >= 35.5 && lat < 36.7 && lng >= 128.0 && lng < 129.3) return '경북';
  if (lat < 35.0 && lng >= 128.0) return '경남';
  if (lat >= 36.3 && lat < 37.6 && lng >= 126.5 && lng < 128.0) return '경기';
  if (lat >= 35.5 && lat < 36.8 && lng >= 127.0 && lng < 128.2) return '충청';
  if (lat >= 34.5 && lat < 35.8 && lng < 127.5) return '전북';
  return '기타';
}

export function parseSpotMapLabels(
  name: string,
  lat: number,
  lng: number,
): { regionKey: string; shortTitle: string } {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';

  if (PROVINCE_FIRST_TOKEN.has(first)) {
    const rest = parts.slice(1).join(' ').trim();
    return {
      regionKey: first,
      shortTitle: (rest || trimmed).slice(0, 32),
    };
  }

  const provinceFromCounty = COUNTY_FIRST_TO_PROVINCE[first];
  if (provinceFromCounty) {
    return {
      regionKey: provinceFromCounty,
      shortTitle: trimmed.slice(0, 32),
    };
  }

  return {
    regionKey: guessRegionKeyFromLatLng(lat, lng),
    shortTitle: trimmed.slice(0, 32),
  };
}
