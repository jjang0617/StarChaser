import {
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  SPOT_REPOSITORY,
  type SpotRepository,
  type Spot,
} from '../common/interfaces/spot.repository';
import { MOON_ALTITUDE_MISSING_SENTINEL } from '../sky/kasi.mapper';
import { moonStateAtObserver } from '../sky/moon-ephemeris.util';
import { skyCodeToLabel } from '../cache-hydration/kma-forecast.util';
import type { WeatherSnapshot } from '../common/interfaces/weather-snapshot';
import { normalizeWeatherSnapshotForStorage } from '../common/interfaces/weather-snapshot';
import {
  enrichWeatherSnapshotForDisplay,
  normalizeDustCacheEntry,
  normalizeWeatherCacheEntry,
} from '../common/weather-snapshot-display.util';
import { CorrectionsService } from '../corrections/corrections.service';
import { getKstYmd } from '../common/kst-date';
import { StarIndexCacheHydrationService } from '../cache-hydration/star-index-cache-hydration.service';

// ── 기상 데이터 타입 ─────────────────────────────────────────
interface WeatherData {
  skyCode: number;
  cloud: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  temperature: number;
  pop: number;
}

interface DustData {
  pm25: number;
  pm25Label?: string;
  stationName?: string;
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
    @Inject(SPOT_REPOSITORY) private readonly spots: SpotRepository,
    private readonly correctionsService: CorrectionsService,
    private readonly cacheHydration: StarIndexCacheHydrationService,
  ) {}

  async calculateForSpotFromCache(spot: Spot): Promise<{
    score: number;
    weatherSnapshot: WeatherSnapshot;
    cacheKeys: { weatherKey: string; dustKey: string; moonKey: string };
  }> {
    await this.cacheHydration.ensureForStarIndexRequest(spot.lat, spot.lng);

    const { nx, ny } = this.latLngToGrid(spot.lat, spot.lng);
    const weatherKey = `weather:${nx}:${ny}`;
    const dustKey = await this.cacheHydration.resolveDustCacheKey(
      spot.lat,
      spot.lng,
    );
    const moonKey = `moon:${getKstYmd().replace(/-/g, '')}`;

    const weather = this.readWeatherCache(
      await this.cache.get(weatherKey),
    );
    const dust = this.readDustCache(await this.cache.get(dustKey));
    const moonRaw = await this.cache.get<MoonData>(moonKey);

    if (!weather || !dust || !moonRaw) {
      throw new ServiceUnavailableException(
        '기상·미세먼지·달 데이터를 가져오지 못했습니다. KMA_API_KEY·AIRKOREA_API_KEY와 네트워크를 확인하세요.',
      );
    }

    const moon = this.resolveMoonAt(spot.lat, spot.lng, moonRaw);
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
   * GPS(또는 임의 좌표) 격자 기상 + 주변 명소 Bortle/고도/보정으로 Star-Index.
   * 명소 spotId 캐시는 쓰지 않고 매 요청 계산한다.
   */
  async calculateForLatLngFromCache(lat: number, lng: number): Promise<{
    score: number;
    weatherSnapshot: WeatherSnapshot;
    cacheKeys: { weatherKey: string; dustKey: string; moonKey: string };
    nearestSpot: Spot | null;
    distanceKm: number | null;
  }> {
    await this.cacheHydration.ensureForStarIndexRequest(lat, lng);

    const { nx, ny } = this.latLngToGrid(lat, lng);
    const weatherKey = `weather:${nx}:${ny}`;
    const dustKey = await this.cacheHydration.resolveDustCacheKey(lat, lng);
    const moonKey = `moon:${getKstYmd().replace(/-/g, '')}`;

    const weather = this.readWeatherCache(
      await this.cache.get(weatherKey),
    );
    const dust = this.readDustCache(await this.cache.get(dustKey));
    const moonRaw = await this.cache.get<MoonData>(moonKey);

    if (!weather || !dust || !moonRaw) {
      throw new ServiceUnavailableException(
        '기상·미세먼지·달 데이터를 가져오지 못했습니다. KMA_API_KEY·AIRKOREA_API_KEY와 네트워크를 확인하세요.',
      );
    }

    const moon = this.resolveMoonAt(lat, lng, moonRaw);
    const nearby = await this.spots.findNearby(lat, lng, 200_000);
    const nearest = this.pickNearestSpot(lat, lng, nearby);
    const distanceKm = nearest
      ? this.haversineKm(lat, lng, nearest.lat, nearest.lng)
      : null;

    const bortleClass = nearest?.bortleClass ?? 5;
    const elevationM = nearest?.elevationM ?? 100;
    const correctionScore = nearest
      ? await this.correctionsService.getAggregatedCorrectionScoreForSpot(
          nearest.id,
        )
      : 100;

    const { score, weatherSnapshot } = this.calcStarIndexWithSnapshot({
      weather,
      dust,
      moon,
      bortleClass,
      elevationM,
      correctionScore,
    });

    return {
      score,
      weatherSnapshot,
      cacheKeys: { weatherKey, dustKey, moonKey },
      nearestSpot: nearest,
      distanceKm,
    };
  }

  private pickNearestSpot(lat: number, lng: number, spots: Spot[]): Spot | null {
    if (!spots.length) return null;
    let best = spots[0];
    let bestD = this.haversineKm(lat, lng, best.lat, best.lng);
    for (let i = 1; i < spots.length; i += 1) {
      const s = spots[i];
      const d = this.haversineKm(lat, lng, s.lat, s.lng);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  private haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * `star_index:{spotId}` 캐시를 보지 않고, 현재 weather/dust/moon 캐시만으로 점수 계산.
   * 일별 스냅샷·주간 TOP5 집계 등 배치용.
   */
  async computeFreshScoreFromCache(spot: Spot): Promise<number> {
    await this.cacheHydration.ensureForStarIndexRequest(spot.lat, spot.lng);

    const { nx, ny } = this.latLngToGrid(spot.lat, spot.lng);
    const weatherKey = `weather:${nx}:${ny}`;
    const dustKey = await this.cacheHydration.resolveDustCacheKey(
      spot.lat,
      spot.lng,
    );
    const moonKey = `moon:${getKstYmd().replace(/-/g, '')}`;

    const weather = this.readWeatherCache(
      await this.cache.get(weatherKey),
    );
    const dust = this.readDustCache(await this.cache.get(dustKey));
    const moonRaw = await this.cache.get<MoonData>(moonKey);

    if (!weather || !dust || !moonRaw) {
      throw new ServiceUnavailableException(
        '기상·미세먼지·달 데이터를 가져오지 못했습니다. API 키·네트워크를 확인하세요.',
      );
    }

    const moon = this.resolveMoonAt(spot.lat, spot.lng, moonRaw);
    const correctionScore =
      await this.correctionsService.getAggregatedCorrectionScoreForSpot(spot.id);

    const { score } = this.calcStarIndexWithSnapshot({
      weather,
      dust,
      moon,
      bortleClass: spot.bortleClass,
      elevationM: spot.elevationM,
      correctionScore,
    });
    return score;
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
    const weatherSnapshot = enrichWeatherSnapshotForDisplay(
      normalizeWeatherSnapshotForStorage(raw),
    );
    const score = this.aggregateScoreFromSnapshot(
      weatherSnapshot,
      input.weather.pop,
    );
    return { score, weatherSnapshot };
  }

  private readWeatherCache(raw: unknown): WeatherData | null {
    const n = normalizeWeatherCacheEntry(raw);
    if (!n || n.cloud === undefined) return null;
    const w = raw as Record<string, unknown>;
    const skyRaw = Number(w.skyCode);
    return {
      skyCode: Number.isFinite(skyRaw) ? skyRaw : (n.skyCode ?? 1),
      cloud: n.cloud,
      humidity: Number(w.humidity) || 70,
      windSpeed: Number(w.windSpeed) || 2,
      visibility: Number(w.visibility) || 10,
      temperature: Number(w.temperature) || 12,
      pop: Number(w.pop) || 0,
    };
  }

  private readDustCache(raw: unknown): DustData | null {
    const n = normalizeDustCacheEntry(raw);
    if (n?.pm25 === undefined || !Number.isFinite(n.pm25)) return null;
    return {
      pm25: n.pm25,
      pm25Label: n.pm25Label,
      stationName: n.stationName,
    };
  }

  private resolveMoonAt(lat: number, lng: number, cached: MoonData): MoonData {
    const ephemeris = moonStateAtObserver(lat, lng);
    return {
      phase: cached.phase > 0 ? cached.phase : ephemeris.phase,
      altitude: ephemeris.altitude,
      moonAltitudeKnown: true,
    };
  }

  private buildRawWeatherSnapshot(input: StarIndexInput): WeatherSnapshot {
    const { weather, dust, moon, bortleClass, elevationM } = input;
    const skyCode = weather.skyCode;

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
      cloud_sky_code: skyCode,
      cloud_sky_label: skyCodeToLabel(skyCode),
      cloud_cover_pct: weather.cloud,
      pm25_ug_m3: dust.pm25,
      pm25_label: dust.pm25Label,
      pm25_station_name: dust.stationName,
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
