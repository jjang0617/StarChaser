import {
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { Spot } from '../common/interfaces/spot.repository';
import { MOON_ALTITUDE_MISSING_SENTINEL } from '../sky/kasi.mapper';
import type { WeatherSnapshot } from '../common/interfaces/weather-snapshot';
import { normalizeWeatherSnapshotForStorage } from '../common/interfaces/weather-snapshot';
import { CorrectionsService } from '../corrections/corrections.service';

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
  altitude: number;    // 달 고도 (도) — RiseSet만 쓸 때 센티넬(-10)일 수 있음
  moonAltitudeKnown?: boolean;
}

interface StarIndexInput {
  weather: WeatherData;
  dust: DustData;
  moon: MoonData;
  bortleClass: number; // 광공해 Bortle 등급 (1~9)
  elevationM: number; // 해발고도 (m) — GPS 고도 변수
  /** 제보 집계값; 없으면 100(중립) */
  correctionScore?: number;
}

/** star_index:{spotId} 캐시 페이로드 — 레거시 number 캐시는 재계산 시 교체 */
type StarIndexCachePayload = { score: number; weatherSnapshot: WeatherSnapshot };

@Injectable()
export class StarIndexService {
  private readonly logger = new Logger(StarIndexService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly correctionsService: CorrectionsService,
  ) {}

  async calculateForSpotFromCache(spot: Spot): Promise<{
    score: number;
    weatherSnapshot: WeatherSnapshot;
    cacheKeys: { weatherKey: string; dustKey: string; moonKey: string };
  }> {
    const { nx, ny } = this.latLngToGrid(spot.lat, spot.lng);
    const weatherKey = `weather:${nx}:${ny}`;
    const dustKey = 'dust:서울';
    const moonKey = `moon:${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    const weather = await this.cache.get<WeatherData>(weatherKey);
    const dust = await this.cache.get<DustData>(dustKey);
    const moon = await this.cache.get<MoonData>(moonKey);

    if (!weather || !dust || !moon) {
      const missing = [
        !weather ? weatherKey : null,
        !dust ? dustKey : null,
        !moon ? moonKey : null,
      ]
        .filter(Boolean)
        .join(', ');

      throw new ServiceUnavailableException(
        `캐시 데이터가 부족합니다. 누락 키: ${missing}. Cron 수집기를 먼저 실행하세요.`,
      );
    }

    const correctionScore =
      await this.correctionsService.getAggregatedCorrectionScoreForSpot(spot.id);

    const { score, weatherSnapshot } = await this.getStarIndexBySpotId(spot.id, {
      weather,
      dust,
      moon,
      bortleClass: spot.bortleClass,
      elevationM: spot.elevationM,
      correctionScore,
    });

    return {
      score,
      weatherSnapshot,
      cacheKeys: { weatherKey, dustKey, moonKey },
    };
  }

  /**
   * 캐시에서 Star-Index 조회 — 없으면 계산 후 { score, weatherSnapshot } 저장
   * weather_snapshot 10키는 observations 저장·C 크로스체크와 동일 스키마
   */
  async getStarIndexBySpotId(
    spotId: string,
    input: StarIndexInput,
  ): Promise<{ score: number; weatherSnapshot: WeatherSnapshot }> {
    const cacheKey = `star_index:${spotId}`;

    const cached = await this.cache.get<number | StarIndexCachePayload>(cacheKey);

    if (cached !== undefined && cached !== null) {
      if (typeof cached === 'number') {
        const fresh = this.calcStarIndexWithSnapshot(input);
        await this.cache.set(cacheKey, fresh, 3600 * 1000);
        this.logger.log(
          `Star-Index 레거시 캐시 교체 — spot: ${spotId}, score: ${fresh.score}`,
        );
        return fresh;
      }
      return {
        score: cached.score,
        weatherSnapshot: cached.weatherSnapshot,
      };
    }

    const payload = this.calcStarIndexWithSnapshot(input);
    await this.cache.set(cacheKey, payload, 3600 * 1000);
    this.logger.log(`Star-Index 계산 완료 — spot: ${spotId}, score: ${payload.score}`);

    return payload;
  }

  /** 최종 점수만 필요할 때 */
  calcStarIndex(input: StarIndexInput): number {
    return this.calcStarIndexWithSnapshot(input).score;
  }

  /**
   * 10변수 점수 스냅샷 + 합산 점수
   * - 보정: correction_score(0~100) × 0.01 가중 — 기본 100이면 기존 +1과 동일
   * - moon_effect_score: altitude < 0 이면 100(지평선 아래, 달 영향 없음)
   */
  calcStarIndexWithSnapshot(input: StarIndexInput): StarIndexCachePayload {
    const raw = this.buildRawWeatherSnapshot(input);
    const weatherSnapshot = normalizeWeatherSnapshotForStorage(raw);
    const score = this.aggregateScoreFromSnapshot(
      weatherSnapshot,
      input.weather.pop,
    );
    return { score, weatherSnapshot };
  }

  private buildRawWeatherSnapshot(input: StarIndexInput): WeatherSnapshot {
    const { weather, dust, moon, bortleClass, elevationM } = input;

    return {
      cloud_score: this.calcCloudScore(weather.cloud),
      pm25_score: this.calcPm25Score(dust.pm25),
      light_pollution_score: this.calcLightPollutionScore(bortleClass),
      moon_effect_score: this.calcMoonScore(
        moon.phase,
        moon.altitude,
        moon.moonAltitudeKnown,
      ),
      humidity_score: this.calcHumidityScore(weather.humidity),
      elevation_score: this.calcElevationScore(elevationM),
      wind_score: this.calcWindScore(weather.windSpeed),
      visibility_score: this.calcVisibilityScore(weather.visibility),
      temperature_score: this.calcTempScore(weather.temperature),
      correction_score: input.correctionScore ?? 100,
      precipitation_probability: weather.pop,
      moon_altitude_deg: moon.altitude,
      moon_altitude_known: moon.moonAltitudeKnown,
      lun_phase: moon.phase,
    };
  }

  private aggregateScoreFromSnapshot(
    snap: WeatherSnapshot,
    pop: number,
  ): number {
    let score =
      snap.cloud_score * 0.28 +
      snap.pm25_score * 0.17 +
      snap.light_pollution_score * 0.17 +
      snap.moon_effect_score * 0.12 +
      snap.humidity_score * 0.1 +
      snap.elevation_score * 0.06 +
      snap.wind_score * 0.04 +
      snap.visibility_score * 0.03 +
      snap.temperature_score * 0.02 +
      snap.correction_score * 0.01;

    if (pop >= 60) {
      score *= 0.4;
    }

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  // ── 각 변수 점수 계산 함수들 ─────────────────────────────────

  private calcCloudScore(cloud: number): number {
    return Math.max(0, 100 - cloud);
  }

  private calcPm25Score(pm25: number): number {
    if (pm25 <= 15) return 100;
    if (pm25 <= 35) return 75;
    if (pm25 <= 75) return 40;
    return 0;
  }

  private calcLightPollutionScore(bortleClass: number): number {
    return Math.max(0, Math.round(((9 - bortleClass) / 8) * 100));
  }

  /**
   * RiseSet만 쓸 때 고도 필드 부재 → 센티넬(-10) + known=false → 달 감점 없음(100)
   * 음수 고도는 지평선 아래 → 달 감점 없음(100)
   */
  private calcMoonScore(
    phase: number,
    altitudeDeg: number,
    altitudeKnown?: boolean,
  ): number {
    const altitudeMissing =
      altitudeKnown === false ||
      (altitudeKnown === undefined &&
        altitudeDeg === MOON_ALTITUDE_MISSING_SENTINEL);
    if (altitudeMissing) return 100;
    if (altitudeDeg < 0) return 100;
    const moonEffect = phase * (altitudeDeg / 90);
    return Math.round((1 - moonEffect) * 100);
  }

  private calcHumidityScore(humidity: number): number {
    if (humidity <= 70) return 100;
    if (humidity >= 90) return 0;
    return Math.round(((90 - humidity) / 20) * 100);
  }

  private calcElevationScore(elevationM: number): number {
    return Math.min(100, Math.round(elevationM / 5));
  }

  private calcWindScore(windSpeed: number): number {
    if (windSpeed <= 5) return 100;
    if (windSpeed >= 10) return 0;
    return Math.round(((10 - windSpeed) / 5) * 100);
  }

  private calcVisibilityScore(visibilityKm: number): number {
    if (visibilityKm >= 10) return 100;
    if (visibilityKm < 5) return 0;
    return Math.round(((visibilityKm - 5) / 5) * 100);
  }

  private calcTempScore(temp: number): number {
    if (temp >= 5 && temp <= 20) return 100;
    if (temp < -10 || temp > 35) return 20;
    return 60;
  }

  // ── 기상청 격자 좌표 변환 (위도·경도 → nx, ny) ───────────────
  private latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
    const RE = 6371.00877;
    const GRID = 5.0;
    const SLAT1 = 30.0;
    const SLAT2 = 60.0;
    const OLON = 126.0;
    const OLAT = 38.0;
    const XO = 43;
    const YO = 136;

    const DEGRAD = Math.PI / 180.0;

    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;

    let sn =
      Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
      Math.tan(Math.PI * 0.25 + slat1 * 0.5);
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
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`API 호출 실패: ${msg}`);
    }
  }
}
