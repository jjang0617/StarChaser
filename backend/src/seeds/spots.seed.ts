import dataSource from '../database/data-source';
import { Logger } from '@nestjs/common';

type SpotSeedRow = {
  name: string;
  lng: number;
  lat: number;
  bortleClass: number;
  elevationM: number;
  hasParking: boolean;
  hasToilet: boolean;
  locationRadiusM: number;
};

// ──────────────────────────────────────────────────────────────
// 명소 Seeding 스크립트 — 지영재(C) 담당
// elevation_m 필수 입력! (Star-Index GPS 고도 변수 소스)
// ──────────────────────────────────────────────────────────────
const spotsSeedData: SpotSeedRow[] = [
  // ⚠️ elevation_m 반드시 입력 — Google Maps 위성 뷰 또는 국토지리정보원 확인
  {
    name: '영월 별마로 천문대',
    // ST_MakePoint(경도, 위도) — 순서 주의!
    lng: 128.4870,
    lat: 37.1984,
    bortleClass: 2,
    elevationM: 769,   // ⭐ 필수
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 200,
  },
  {
    name: '강원 인제 원대리',
    lng: 128.2292,
    lat: 37.9995,
    bortleClass: 2,
    elevationM: 336,   // ⭐ 필수
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경북 영양 반딧불이공원',
    lng: 129.2672,
    lat: 36.8294,
    bortleClass: 1,
    elevationM: 318,   // ⭐ 필수
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 200,
  },
  {
    name: '전남 신안 가거도',
    lng: 125.1131,
    lat: 34.0714,
    bortleClass: 1,
    elevationM: 427,    // ⭐ 필수
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 500,
  },
  {
    name: '강원 태백 매봉산 풍력단지',
    lng: 128.9659,
    lat: 37.2133,
    bortleClass: 2,
    elevationM: 1252,  // ⭐ 필수
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 200,
  },
];

async function seedSpots(): Promise<void> {
  const logger = new Logger('SpotsSeed');
  await dataSource.initialize();

  try {
    for (const spot of spotsSeedData) {
      await dataSource.query(
        `
        INSERT INTO spots (
          name, location, bortle_class, elevation_m, has_parking, has_toilet, location_radius_m
        )
        SELECT
          $1::varchar,
          ST_SetSRID(ST_MakePoint($2::double precision, $3::double precision), 4326),
          $4::smallint,
          $5::int,
          $6::boolean,
          $7::boolean,
          $8::int
        WHERE NOT EXISTS (
          SELECT 1 FROM spots WHERE name = $1::varchar
        )
        `,
        [
          spot.name,
          spot.lng,
          spot.lat,
          spot.bortleClass,
          spot.elevationM,
          spot.hasParking,
          spot.hasToilet,
          spot.locationRadiusM,
        ],
      );
    }

    const countRows = (await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM spots`,
    )) as Array<{ count: number }>;

    const nullElevationRows = (await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM spots WHERE elevation_m IS NULL`,
    )) as Array<{ count: number }>;

    logger.log(
      `spots 완료 - total: ${countRows[0]?.count ?? 0}, elevation_m null: ${
        nullElevationRows[0]?.count ?? 0
      }`,
    );
  } finally {
    await dataSource.destroy();
  }
}

seedSpots().catch((error: unknown) => {
  const logger = new Logger('SpotsSeed');
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`spots 실패 - ${message}`);
  process.exit(1);
});
