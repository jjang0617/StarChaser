/** WGS84 경계 상자로 시·도 근사 (에어코리아 sidoName) */

export type SidoBbox = {
  sidoName: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export const AIRKOREA_SIDO_BBOXES: SidoBbox[] = [
  { sidoName: '서울', minLat: 37.42, maxLat: 37.72, minLng: 126.76, maxLng: 127.18 },
  { sidoName: '인천', minLat: 37.26, maxLat: 37.78, minLng: 126.28, maxLng: 126.89 },
  { sidoName: '경기', minLat: 36.89, maxLat: 38.31, minLng: 126.47, maxLng: 127.98 },
  { sidoName: '강원', minLat: 37.02, maxLat: 38.61, minLng: 127.05, maxLng: 129.46 },
  { sidoName: '충북', minLat: 36.26, maxLat: 37.21, minLng: 127.29, maxLng: 128.58 },
  { sidoName: '충남', minLat: 35.97, maxLat: 37.06, minLng: 126.08, maxLng: 127.68 },
  { sidoName: '세종', minLat: 36.42, maxLat: 36.60, minLng: 127.21, maxLng: 127.37 },
  { sidoName: '대전', minLat: 36.25, maxLat: 36.48, minLng: 127.30, maxLng: 127.54 },
  { sidoName: '전북', minLat: 35.25, maxLat: 36.19, minLng: 126.42, maxLng: 127.69 },
  { sidoName: '광주', minLat: 35.07, maxLat: 35.25, minLng: 126.68, maxLng: 126.95 },
  { sidoName: '전남', minLat: 34.21, maxLat: 35.73, minLng: 125.99, maxLng: 127.59 },
  { sidoName: '대구', minLat: 35.68, maxLat: 36.01, minLng: 128.35, maxLng: 128.78 },
  { sidoName: '경북', minLat: 35.67, maxLat: 37.52, minLng: 127.98, maxLng: 129.60 },
  { sidoName: '울산', minLat: 35.33, maxLat: 35.70, minLng: 128.99, maxLng: 129.48 },
  { sidoName: '부산', minLat: 34.88, maxLat: 35.40, minLng: 128.74, maxLng: 129.32 },
  { sidoName: '경남', minLat: 34.69, maxLat: 35.90, minLng: 127.57, maxLng: 129.30 },
  { sidoName: '제주', minLat: 33.10, maxLat: 33.58, minLng: 126.15, maxLng: 126.98 },
];

export function findSidoByLatLng(lat: number, lng: number): string {
  const hits = AIRKOREA_SIDO_BBOXES.filter(
    (b) =>
      lat >= b.minLat &&
      lat <= b.maxLat &&
      lng >= b.minLng &&
      lng <= b.maxLng,
  );
  if (hits.length === 1) {
    return hits[0].sidoName;
  }
  if (hits.length > 1) {
    // 겹치는 경계(수도권 등) — 중심에 가장 가까운 시·도
    let best = hits[0];
    let bestD = Number.POSITIVE_INFINITY;
    for (const b of hits) {
      const cLat = (b.minLat + b.maxLat) / 2;
      const cLng = (b.minLng + b.maxLng) / 2;
      const d = (lat - cLat) ** 2 + (lng - cLng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best.sidoName;
  }
  // 해상·국경 밖 — 전국 중심에 가장 가까운 시·도
  let best = AIRKOREA_SIDO_BBOXES[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const b of AIRKOREA_SIDO_BBOXES) {
    const cLat = (b.minLat + b.maxLat) / 2;
    const cLng = (b.minLng + b.maxLng) / 2;
    const d = (lat - cLat) ** 2 + (lng - cLng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best.sidoName;
}
