import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// ── 기상 데이터 타입 ─────────────────────────────────────────
interface WeatherData {
  cloud: number;       // 운량 (0~100%)
  humidity: number;    // 습도 (%)
  windSpeed: number;   // 풍속 (m/s)
  visibility: number;  // 시정 (km)
  temperature: number; // 기온 (℃)
  pop: number;         // 강수확률 (%)
}

interface DustData {
  pm25: number;        // PM2.5 (㎍/㎥)
}

interface MoonData {
  phase: number;       // 달 위상 (0~1, 0=삭, 1=보름)
  altitude: number;    // 달 고도 (도, 음수=지평선 아래)
}

interface StarIndexInput {
  weather: WeatherData;
  dust: DustData;
  moon: MoonData;
  bortleClass: number; // 광공해 Bortle 등급 (1~9)
  elevationM: number;  // 해발고도 (m) — GPS 고도 변수
}

@Injectable()
export class StarIndexService {
  private readonly logger = new Logger(StarIndexService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  // ── 캐시에서 Star-Index 조회 (없으면 계산 후 저장) ──────────
  async getStarIndexBySpotId(spotId: string, input: StarIndexInput): Promise<number> {
    const cacheKey = `star_index:${spotId}`;

    // 1. 캐시 히트 확인
    const cached = await this.cache.get<number>(cacheKey);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    // 2. 캐시 미스 → 계산
    const score = this.calcStarIndex(input);

    // 3. 캐시 저장 (TTL 1시간)
    await this.cache.set(cacheKey, score, 3600 * 1000);
    this.logger.log(`Star-Index 계산 완료 — spot: ${spotId}, score: ${score}`);

    return score;
  }

  // ── Star-Index 10변수 계산 알고리즘 ─────────────────────────
  calcStarIndex(input: StarIndexInput): number {
    const { weather, dust, moon, bortleClass, elevationM } = input;

    // 각 변수를 0~100점으로 정규화
    const cloudScore      = this.calcCloudScore(weather.cloud);
    const pm25Score       = this.calcPm25Score(dust.pm25);
    const lightPollScore  = this.calcLightPollutionScore(bortleClass);
    const moonScore       = this.calcMoonScore(moon.phase, moon.altitude);
    const humidityScore   = this.calcHumidityScore(weather.humidity);
    const elevationScore  = this.calcElevationScore(elevationM);
    const windScore       = this.calcWindScore(weather.windSpeed);
    const visibilityScore = this.calcVisibilityScore(weather.visibility);
    const tempScore       = this.calcTempScore(weather.temperature);

    // 가중치 합산 (합계 = 100%)
    let score =
      cloudScore      * 0.28 +  // 운량 28%
      pm25Score       * 0.17 +  // PM2.5 17%
      lightPollScore  * 0.17 +  // 광공해 17%
      moonScore       * 0.12 +  // 달 위상×고도 12%
      humidityScore   * 0.10 +  // 습도 10%
      elevationScore  * 0.06 +  // GPS 고도 6% ⭐
      windScore       * 0.04 +  // 풍속 4%
      visibilityScore * 0.03 +  // 시정 3%
      tempScore       * 0.02 +  // 기온 2%
      1;                         // 보정 1% (추후 유저 제보 반영)

    // 강수 확률 패널티 (60% 이상이면 전체 × 0.4)
    if (weather.pop >= 60) {
      score *= 0.4;
    }

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  // ── 각 변수 점수 계산 함수들 ─────────────────────────────────

  private calcCloudScore(cloud: number): number {
    // 운량 0% = 100점, 100% = 0점 (선형)
    return Math.max(0, 100 - cloud);
  }

  private calcPm25Score(pm25: number): number {
    // 좋음(0~15) = 100 / 보통(16~35) = 75 / 나쁨(36~75) = 40 / 매우나쁨(76+) = 0
    if (pm25 <= 15) return 100;
    if (pm25 <= 35) return 75;
    if (pm25 <= 75) return 40;
    return 0;
  }

  private calcLightPollutionScore(bortleClass: number): number {
    // Bortle 1(완전 암흑) = 100점, Bortle 9(도심) = 0점
    return Math.max(0, Math.round((9 - bortleClass) / 8 * 100));
  }

  private calcMoonScore(phase: number, altitudeDeg: number): number {
    // 달이 지평선 아래면 영향 없음 (MoonEffect = 0)
    if (altitudeDeg < 0) return 100;
    // 고도 비례 영향: 보름달 + 고도 90도 = 최대 감점
    const moonEffect = phase * (altitudeDeg / 90);
    return Math.round((1 - moonEffect) * 100);
  }

  private calcHumidityScore(humidity: number): number {
    // 70% 이하 = 100점, 90% 이상 = 0점
    if (humidity <= 70) return 100;
    if (humidity >= 90) return 0;
    return Math.round((90 - humidity) / 20 * 100);
  }

  private calcElevationScore(elevationM: number): number {
    // 해발 0m = 0점, 500m 이상 = 100점 (선형)
    return Math.min(100, Math.round(elevationM / 5));
  }

  private calcWindScore(windSpeed: number): number {
    // 5m/s 이하 = 100점, 10m/s 이상 = 0점
    if (windSpeed <= 5) return 100;
    if (windSpeed >= 10) return 0;
    return Math.round((10 - windSpeed) / 5 * 100);
  }

  private calcVisibilityScore(visibilityKm: number): number {
    // 10km 이상 = 100점, 5km 미만 = 0점
    if (visibilityKm >= 10) return 100;
    if (visibilityKm < 5) return 0;
    return Math.round((visibilityKm - 5) / 5 * 100);
  }

  private calcTempScore(temp: number): number {
    // 5~20℃ 최적 = 100점, 극단값 감점
    if (temp >= 5 && temp <= 20) return 100;
    if (temp < -10 || temp > 35) return 20;
    return 60;

    
  }

// ── 기상청 격자 좌표 변환 (위도·경도 → nx, ny) ───────────────
private latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
  const RE = 6371.00877;   // 지구 반경 (km)
  const GRID = 5.0;        // 격자 간격 (km)
  const SLAT1 = 30.0;      // 투영 위도 1 (도)
  const SLAT2 = 60.0;      // 투영 위도 2 (도)
  const OLON = 126.0;      // 기준점 경도 (도)
  const OLAT = 38.0;       // 기준점 위도 (도)
  const XO = 43;           // 기준점 X 좌표 (격자)
  const YO = 136;          // 기준점 Y 좌표 (격자)

  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  const ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  const raVal = (re * sf) / Math.pow(ra, sn);

  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(raVal * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - raVal * Math.cos(theta) + YO + 0.5);

  return { nx, ny };
}


async testApiConnections(lat = 37.5665, lng = 126.9780): Promise<void> {
  const KMA_KEY = process.env.KMA_API_KEY;
  const AIRKOREA_KEY = process.env.AIRKOREA_API_KEY;

  // GPS → 기상청 격자 변환
  const { nx, ny } = this.latLngToGrid(lat, lng);
  this.logger.log(`격자 변환 결과 — lat: ${lat}, lng: ${lng} → nx: ${nx}, ny: ${ny}`);

  const now = new Date();
  const baseDate = now.toISOString().slice(0, 10).replace(/-/g, '');
  const baseTime = '0500';

  const kmaUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${KMA_KEY}&numOfRows=10&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${nx}&ny=${ny}`;

  const airUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${AIRKOREA_KEY}&returnType=json&numOfRows=5&pageNo=1&sidoName=서울&ver=1.0`;

  try {
    const [kmaRes, airRes] = await Promise.all([
      fetch(kmaUrl),
      fetch(airUrl),
    ]);

    const kmaData = await kmaRes.json();
    const airData = await airRes.json();

    this.logger.log(`기상청 API 응답: ${JSON.stringify(kmaData).slice(0, 200)}`);
    this.logger.log(`에어코리아 API 응답: ${JSON.stringify(airData).slice(0, 200)}`);

  } catch (e) {
    this.logger.error(`API 호출 실패: ${e.message}`);
  }
}
}