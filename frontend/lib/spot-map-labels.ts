/**
 * 명소 이름에서 지도 클러스터용 광역 키·짧은 라벨 추출.
 * 시드 형식: "경북 영천 보현산천문대", "영월 별마로 천문대" 등
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

/**
 * 대한민국 대략 구역(위경도 박스) — 첫 토큰이 도 이름이 아닐 때 보조.
 * 경계는 근사치(MVP).
 */
export function guessRegionKeyFromLatLng(lat: number, lng: number): string {
  if (lat < 33.0 || lat > 38.7 || lng < 124.0 || lng > 132.5) {
    return '기타';
  }
  if (lat >= 33.0 && lat < 34.5 && lng < 127.0) return '제주·남해';
  if (lng < 126.2) return '전라·황해';
  if (lat >= 35.5 && lat < 36.7 && lng >= 128.0 && lng < 129.3) return '대구·경북';
  if (lat < 35.0 && lng >= 128.0) return '경남·부울';
  if (lat >= 36.3 && lat < 37.6 && lng >= 126.5 && lng < 128.0) return '수도권·충북';
  if (lat >= 37.2 && lng >= 127.0) return '강원·경기북';
  if (lat >= 35.5 && lat < 36.8 && lng >= 127.0 && lng < 128.2) return '충청·세종';
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

  return {
    regionKey: guessRegionKeyFromLatLng(lat, lng),
    shortTitle: trimmed.slice(0, 32),
  };
}
