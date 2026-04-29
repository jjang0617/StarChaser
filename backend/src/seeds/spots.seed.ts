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
    name: '경북 영천 보현산천문대 인근',
    lng: 128.9783,
    lat: 36.1615,
    bortleClass: 1,
    elevationM: 1097,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '충북 단양 소백산천문대 인근',
    lng: 128.4571,
    lat: 36.9343,
    bortleClass: 1,
    elevationM: 1323,
    hasParking: false,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전북 무주 덕유산 향적봉 인근',
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
    lng: 127.7238,
    lat: 35.9564,
    bortleClass: 2,
    elevationM: 855,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '경남 합천 황매산 오토캠핑장',
    lng: 128.0609,
    lat: 35.4885,
    bortleClass: 2,
    elevationM: 1108,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경남 산청 지리산 정령치 휴게소',
    lng: 127.6052,
    lat: 35.3086,
    bortleClass: 2,
    elevationM: 1172,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '전남 구례 성삼재 휴게소',
    lng: 127.5268,
    lat: 35.3031,
    bortleClass: 2,
    elevationM: 1102,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '강원 정선 민둥산 정상부',
    lng: 128.6922,
    lat: 37.2208,
    bortleClass: 2,
    elevationM: 1118,
    hasParking: false,
    hasToilet: false,
    locationRadiusM: 400,
  },
  {
    name: '강원 평창 육백마지기',
    lng: 128.6664,
    lat: 37.4386,
    bortleClass: 1,
    elevationM: 1240,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '강원 정선 만항재',
    lng: 128.9161,
    lat: 37.2098,
    bortleClass: 1,
    elevationM: 1330,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '강원 홍천 은하수길 전망대',
    lng: 128.3241,
    lat: 37.7168,
    bortleClass: 2,
    elevationM: 780,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '강원 양구 두타연 주차장 인근',
    lng: 128.1286,
    lat: 38.2499,
    bortleClass: 2,
    elevationM: 515,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '강원 삼척 덕항산 하이원 추추파크 인근',
    lng: 129.0308,
    lat: 37.3249,
    bortleClass: 2,
    elevationM: 720,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '강원 인제 한계령 휴게소',
    lng: 128.3957,
    lat: 38.1123,
    bortleClass: 2,
    elevationM: 920,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '경북 봉화 청량산 하늘다리 인근',
    lng: 128.9312,
    lat: 36.8705,
    bortleClass: 2,
    elevationM: 620,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경북 울진 금강소나무숲길 시작점',
    lng: 129.1988,
    lat: 36.9308,
    bortleClass: 2,
    elevationM: 520,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경북 청송 주왕산 상의주차장',
    lng: 129.1661,
    lat: 36.3877,
    bortleClass: 2,
    elevationM: 360,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '충북 괴산 화양계곡 주차장',
    lng: 127.8627,
    lat: 36.8180,
    bortleClass: 3,
    elevationM: 390,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '충남 태안 안면도자연휴양림',
    lng: 126.3688,
    lat: 36.5121,
    bortleClass: 3,
    elevationM: 110,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '충남 청양 칠갑산 천문대',
    lng: 126.9034,
    lat: 36.3924,
    bortleClass: 2,
    elevationM: 561,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '충남 보령 성주산자연휴양림',
    lng: 126.6622,
    lat: 36.3354,
    bortleClass: 3,
    elevationM: 540,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전남 고흥 팔영산 자연휴양림',
    lng: 127.4062,
    lat: 34.5920,
    bortleClass: 2,
    elevationM: 420,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전남 고흥 나로우주센터 우주과학관 인근',
    lng: 127.5355,
    lat: 34.4321,
    bortleClass: 2,
    elevationM: 100,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전남 장흥 천관산 자연휴양림',
    lng: 126.9301,
    lat: 34.5320,
    bortleClass: 2,
    elevationM: 300,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전남 해남 두륜산 케이블카 주차장',
    lng: 126.6203,
    lat: 34.4719,
    bortleClass: 3,
    elevationM: 340,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '전북 진안 마이산 남부주차장',
    lng: 127.4101,
    lat: 35.7448,
    bortleClass: 3,
    elevationM: 310,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '전북 장수 장안산 군립공원 주차장',
    lng: 127.5752,
    lat: 35.6128,
    bortleClass: 2,
    elevationM: 650,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경남 거창 감악산 별바람언덕',
    lng: 127.9248,
    lat: 35.7330,
    bortleClass: 2,
    elevationM: 951,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '경남 함양 오도재',
    lng: 127.6416,
    lat: 35.5537,
    bortleClass: 2,
    elevationM: 773,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 250,
  },
  {
    name: '경남 밀양 표충사 주차장',
    lng: 128.9921,
    lat: 35.5441,
    bortleClass: 3,
    elevationM: 360,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경남 합천 오도산 자연휴양림',
    lng: 128.0266,
    lat: 35.5923,
    bortleClass: 2,
    elevationM: 870,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경남 사천 와룡산 활공장',
    lng: 128.0305,
    lat: 35.0529,
    bortleClass: 3,
    elevationM: 780,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '제주 한라산 1100고지',
    lng: 126.4624,
    lat: 33.3581,
    bortleClass: 2,
    elevationM: 1100,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '제주 새별오름',
    lng: 126.3578,
    lat: 33.3669,
    bortleClass: 3,
    elevationM: 519,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '제주 따라비오름',
    lng: 126.7521,
    lat: 33.3879,
    bortleClass: 2,
    elevationM: 342,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '제주 비자림로 사려니숲길 입구',
    lng: 126.6284,
    lat: 33.4224,
    bortleClass: 2,
    elevationM: 290,
    hasParking: false,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '제주 송악산 주차장',
    lng: 126.2898,
    lat: 33.1990,
    bortleClass: 3,
    elevationM: 104,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '제주 함덕 서우봉 해안 인근',
    lng: 126.6715,
    lat: 33.5430,
    bortleClass: 3,
    elevationM: 111,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '경기 양평 중미산천문대',
    lng: 127.5278,
    lat: 37.5639,
    bortleClass: 3,
    elevationM: 420,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '경기 가평 화악터널 쌈지공원',
    lng: 127.5192,
    lat: 37.9958,
    bortleClass: 2,
    elevationM: 920,
    hasParking: true,
    hasToilet: false,
    locationRadiusM: 300,
  },
  {
    name: '경기 포천 국망봉 자연휴양림',
    lng: 127.3675,
    lat: 38.0308,
    bortleClass: 3,
    elevationM: 520,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 300,
  },
  {
    name: '강원 고성 통일전망대 주차장',
    lng: 128.4210,
    lat: 38.5900,
    bortleClass: 3,
    elevationM: 70,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '강원 양양 오색령 휴게소',
    lng: 128.4449,
    lat: 38.0748,
    bortleClass: 2,
    elevationM: 970,
    hasParking: true,
    hasToilet: true,
    locationRadiusM: 250,
  },
  {
    name: '울산 울주 간월재',
    lng: 129.0342,
    lat: 35.6055,
    bortleClass: 3,
    elevationM: 900,
    hasParking: false,
    hasToilet: true,
    locationRadiusM: 400,
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
