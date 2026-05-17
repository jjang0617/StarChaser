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
    name: '강원 영월 별마로 천문대',
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
  {
    name: '강원 화천 조경철천문대',
    lng: 127.4339,
    lat: 38.1186,
    bortleClass: 2,
    elevationM: 1028,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '경북 영천 보현산천문대',
    lng: 128.9783,
    lat: 36.1615,
    bortleClass: 1,
    elevationM: 1097,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '충북 단양 소백산천문대',
    lng: 128.4571,
    lat: 36.9343,
    bortleClass: 1,
    elevationM: 1323,
    hasParking: false,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전북 무주 덕유산 향적봉',
    lng: 127.7484,
    lat: 35.8579,
    bortleClass: 1,
    elevationM: 1608,
    hasParking: false,
    hasToilet: false,
    locationRadiusM: 400,
  },
  {
    name: '전북 무주 적상산 전망대',
    lng: 127.6998,
    lat: 35.9555,
    bortleClass: 2,
    elevationM: 855,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '경남 합천 황매산 오토캠핑장',
    lng: 127.9833,
    lat: 35.4816,
    bortleClass: 2,
    elevationM: 786,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경남 산청 지리산 정령치 휴게소',
    lng: 127.5242,
    lat: 35.3619,
    bortleClass: 2,
    elevationM: 1168,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '전남 구례 성삼재 휴게소',
    lng: 127.5125,
    lat: 35.3044,
    bortleClass: 2,
    elevationM: 1096,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '강원 정선 민둥산 정상부',
    lng: 128.7749,
    lat: 37.2709,
    bortleClass: 2,
    elevationM: 1101,
    hasParking: false,
    hasToilet: false,
    locationRadiusM: 400,
  },
  {
    name: '강원 평창 육백마지기',
    lng: 128.5151,
    lat: 37.4012,
    bortleClass: 1,
    elevationM: 1200,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '강원 정선 만항재',
    lng: 128.9003,
    lat: 37.1475,
    bortleClass: 1,
    elevationM: 1285,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '강원 홍천 무궁화수목원',
    lng: 127.8372,
    lat: 37.7200,
    bortleClass: 2,
    elevationM: 170,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '강원 양구 두타연계곡',
    lng: 127.9975,
    lat: 38.2706,
    bortleClass: 2,
    elevationM: 335,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '강원 삼척 덕항산 하이원 추추파크',
    lng: 129.0410,
    lat: 37.1807,
    bortleClass: 2,
    elevationM: 474,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '강원 인제 한계령 휴게소',
    lng: 128.4065,
    lat: 38.0973,
    bortleClass: 2,
    elevationM: 927,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '경북 봉화 청량산 하늘다리',
    lng: 128.9143,
    lat: 36.7913,
    bortleClass: 2,
    elevationM: 764,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경북 울진 금강소나무숲길 1구간(보부상길)',
    lng: 129.2565,
    lat: 37.0193,
    bortleClass: 2,
    elevationM: 300,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경북 청송 주왕산 상의주차장',
    lng: 129.1452,
    lat: 36.3908,
    bortleClass: 2,
    elevationM: 259,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '충북 괴산 화양구곡 주차장',
    lng: 127.8030,
    lat: 36.6743,
    bortleClass: 3,
    elevationM: 172,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '충남 태안 안면도자연휴양림',
    lng: 126.3647,
    lat: 36.4980,
    bortleClass: 3,
    elevationM: 65,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '충남 청양 칠갑산 천문대',
    lng: 126.8917,
    lat: 36.4317,
    bortleClass: 2,
    elevationM: 336,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '충남 보령 성주산자연휴양림',
    lng: 126.6639,
    lat: 36.3326,
    bortleClass: 3,
    elevationM: 189,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전남 고흥 팔영산 자연휴양림',
    lng: 127.4397,
    lat: 34.6217,
    bortleClass: 2,
    elevationM: 320,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전남 고흥 나로우주센터 우주과학관',
    lng: 127.5178,
    lat: 34.4534,
    bortleClass: 2,
    elevationM: 6,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전남 장흥 천관산 자연휴양림',
    lng: 126.9039,
    lat: 34.5437,
    bortleClass: 2,
    elevationM: 266,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전남 해남 두륜산 고계봉 전망대',
    lng: 126.6238,
    lat: 34.4870,
    bortleClass: 3,
    elevationM: 357,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전북 진안 마이산 남부주차장',
    lng: 127.3967,
    lat: 35.7526,
    bortleClass: 3,
    elevationM: 327,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '전북 장수 장안산 군립공원 주차장',
    lng: 127.5470,
    lat: 35.6059,
    bortleClass: 2,
    elevationM: 572,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경남 거창 감악산 별바람언덕',
    lng: 127.9177,
    lat: 35.5893,
    bortleClass: 2,
    elevationM: 896,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '경남 함양 오도재',
    lng: 127.7030,
    lat: 35.4430,
    bortleClass: 2,
    elevationM: 730,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 250,
  },
  {
    name: '경남 밀양 표충사',
    lng: 128.9606,
    lat: 35.5326,
    bortleClass: 3,
    elevationM: 194,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경남 합천 오도산 자연휴양림',
    lng: 128.0539,
    lat: 35.6639,
    bortleClass: 2,
    elevationM: 438,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경남 사천 용두공원',
    lng: 128.0916,
    lat: 34.9573,
    bortleClass: 3,
    elevationM: 71,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '제주 한라산 1100고지',
    lng: 126.4640,
    lat: 33.3573,
    bortleClass: 2,
    elevationM: 1098,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '제주 새별오름',
    lng: 126.3580,
    lat: 33.3658,
    bortleClass: 3,
    elevationM: 484,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '제주 따라비오름',
    lng: 126.7534,
    lat: 33.3871,
    bortleClass: 2,
    elevationM: 310,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '제주 비자림로 사려니숲길',
    lng: 126.6623,
    lat: 33.4268,
    bortleClass: 2,
    elevationM: 441,
    hasParking: false,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '제주 송악산 주차장',
    lng: 126.2923,
    lat: 33.2050,
    bortleClass: 3,
    elevationM: 11,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '제주 함덕 서우봉',
    lng: 126.6821,
    lat: 33.5425,
    bortleClass: 3,
    elevationM: 85,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경기 양평 중미산천문대',
    lng: 127.4611,
    lat: 37.5802,
    bortleClass: 3,
    elevationM: 410,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '경기 가평 별빛정원',
    lng: 127.5280,
    lat: 37.9955,
    bortleClass: 2,
    elevationM: 871,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '경기 포천 국망봉 자연휴양림',
    lng: 127.3909,
    lat: 38.0297,
    bortleClass: 3,
    elevationM: 233,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '강원 고성 통일전망대 주차장',
    lng: 128.3766,
    lat: 38.5830,
    bortleClass: 3,
    elevationM: 36,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '강원 양양 한계령령 휴게소',
    lng: 128.4105,
    lat: 38.0940,
    bortleClass: 2,
    elevationM: 909,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '울산 울주 간월재',
    lng: 129.0469,
    lat: 35.5462,
    bortleClass: 3,
    elevationM: 899,
    hasParking: false,
    hasToilet: true,
    locationRadiusM: 400,
  },
];

/** 시드 이름 변경 시 DB 갱신 (INSERT만 하면 구 이름 행이 남음) */
const SPOT_NAME_RENAMES: Array<{ from: string; to: string }> = [
  { from: '영월 별마로 천문대', to: '강원 영월 별마로 천문대' },
];

async function seedSpots(): Promise<void> {
  const logger = new Logger('SpotsSeed');
  await dataSource.initialize();

  try {
    for (const { from, to } of SPOT_NAME_RENAMES) {
      const updated = (await dataSource.query(
        `
        UPDATE spots SET name = $2::varchar
        WHERE name = $1::varchar
        RETURNING id
        `,
        [from, to],
      )) as Array<{ id: string }>;
      if (updated.length > 0) {
        logger.log(`spots 이름 변경: "${from}" → "${to}" (${updated.length}건)`);
      }
    }

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
