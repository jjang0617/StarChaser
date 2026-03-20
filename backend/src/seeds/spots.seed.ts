// ──────────────────────────────────────────────────────────────
// 명소 Seeding 스크립트 — 지영재(C) 담당
// elevation_m 필수 입력! (Star-Index GPS 고도 변수 소스)
// ──────────────────────────────────────────────────────────────

export const spotsSeedData = [
  // ⚠️ elevation_m 반드시 입력 — Google Maps 위성 뷰 또는 국토지리정보원 확인
  {
    name: '영월 별마로 천문대',
    // ST_MakePoint(경도, 위도) — 순서 주의!
    lng: 128.4614,
    lat: 37.1856,
    bortleClass: 2,
    elevationM: 799,   // ⭐ 필수
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 200,
  },
  {
    name: '강원 인제 원대리',
    lng: 128.2167,
    lat: 38.0833,
    bortleClass: 2,
    elevationM: 450,   // ⭐ 필수
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '경북 영양 반딧불이공원',
    lng: 129.1122,
    lat: 36.6667,
    bortleClass: 1,
    elevationM: 280,   // ⭐ 필수
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 200,
  },
  {
    name: '전남 신안 가거도',
    lng: 125.1167,
    lat: 34.0833,
    bortleClass: 1,
    elevationM: 15,    // ⭐ 필수
    hasParking: false,
    hasToilet: true,
    locationRadiusM: 500,
  },
  {
    name: '강원 태백 매봉산 풍력단지',
    lng: 128.9833,
    lat: 37.1167,
    bortleClass: 2,
    elevationM: 1303,  // ⭐ 필수
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 200,
  },
];

// ── Supabase SQL 편집기에서 직접 실행하는 INSERT 예시 ─────────
/*
INSERT INTO spots (name, location, bortle_class, elevation_m, has_parking, has_toilet, location_radius_m)
VALUES
  (
    '영월 별마로 천문대',
    ST_SetSRID(ST_MakePoint(128.4614, 37.1856), 4326),
    2,
    799,
    true,
    true,
    200
  );
*/
