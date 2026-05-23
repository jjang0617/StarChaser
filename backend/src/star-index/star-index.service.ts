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
import { sunAltitudeAtObserver } from '../sky/sun-ephemeris.util';
import { sunAltitudeToObservationScore } from './sun-observation-score.util';
import {
  aggregateStarIndexScore,
  calcCloudScore,
  calcElevationScore,
  calcHumidityHazeScore,
  calcLightPollutionScore,
  calcMoonEffectScore,
  calcPm25Score,
  calcPrecipitationScore,
  calcTemperatureNeutralScore,
  calcVisibilityScore,
  calcWindSeeingScore,
} from './star-index-scoring.util';
import {
  parseForecastNumbers,
  skyCodeToLabel,
  type VilageFcstItem,
} from '../cache-hydration/kma-forecast.util';
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
  visibilityKnown: boolean;
  temperature: number;
  pop: number;
  pty: number;
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
  lat: number;
  lng: number;
  /** 관측 시각(UTC). 없으면 요청 시각 */
  atUtc?: Date;
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

  async calculateForSpotFromCache(
    spot: Spot,
    atUtc?: Date,
  ): Promise<{
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
      atUtc,
    );
    const dust = this.readDustCache(await this.cache.get(dustKey));
    const moonRaw = await this.cache.get<MoonData>(moonKey);

    if (!weather || !dust || !moonRaw) {
      throw new ServiceUnavailableException(
        '기상·미세먼지·달 데이터를 가져오지 못했습니다. KMA_API_KEY·AIRKOREA_API_KEY와 네트워크를 확인하세요.',
      );
    }

    const moon = this.resolveMoonAt(spot.lat, spot.lng, moonRaw, atUtc);
    const correctionScore =
      await this.correctionsService.getAggregatedCorrectionScoreForSpot(spot.id);

    const { score, weatherSnapshot } = await this.getStarIndexBySpotId(
      spot.id,
      {
        weather,
        dust,
        moon,
        bortleClass: spot.bortleClass,
        elevationM: spot.elevationM,
        lat: spot.lat,
        lng: spot.lng,
        atUtc,
        correctionScore,
      },
    );

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
  async calculateForLatLngFromCache(
    lat: number,
    lng: number,
    atUtc?: Date,
  ): Promise<{
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
      atUtc,
    );
    const dust = this.readDustCache(await this.cache.get(dustKey));
    const moonRaw = await this.cache.get<MoonData>(moonKey);

    if (!weather || !dust || !moonRaw) {
      throw new ServiceUnavailableException(
        '기상·미세먼지·달 데이터를 가져오지 못했습니다. KMA_API_KEY·AIRKOREA_API_KEY와 네트워크를 확인하세요.',
      );
    }

    const moon = this.resolveMoonAt(lat, lng, moonRaw, atUtc);
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
      lat,
      lng,
      atUtc,
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
   * 일별 스냅샷·주간 TOP3 집계 등 배치용.
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
      lat: spot.lat,
      lng: spot.lng,
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
    const sunAltDeg = sunAltitudeAtObserver(
      input.lat,
      input.lng,
      input.atUtc ?? new Date(),
    );
    const score = aggregateStarIndexScore({
      components: weatherSnapshot,
      cloudPercent: input.weather.cloud,
      sunAltitudeDeg: sunAltDeg,
      pop: input.weather.pop,
      pty: input.weather.pty,
      visibilityKnown: input.weather.visibilityKnown,
    });
    return { score, weatherSnapshot };
  }

  private readWeatherCache(raw: unknown, atUtc?: Date): WeatherData | null {
    const n = normalizeWeatherCacheEntry(raw);
    if (!n || n.cloud === undefined) return null;
    const w = raw as Record<string, unknown>;
    const items = w.fcstItems;
    if (Array.isArray(items) && items.length > 0) {
      const nums = parseForecastNumbers(
        items as VilageFcstItem[],
        atUtc ?? new Date(),
      );
      return {
        skyCode: nums.skyCode,
        cloud: nums.cloud,
        humidity: nums.humidity,
        windSpeed: nums.windSpeed,
        visibility: nums.visibility,
        visibilityKnown: nums.visibilityKnown,
        temperature: nums.temperature,
        pop: nums.pop,
        pty: nums.pty,
      };
    }
    const skyRaw = Number(w.skyCode);
    return {
      skyCode: Number.isFinite(skyRaw) ? skyRaw : (n.skyCode ?? 1),
      cloud: n.cloud,
      humidity: Number(w.humidity) || 70,
      windSpeed: Number(w.windSpeed) || 2,
      visibility: Number(w.visibility) || 10,
      visibilityKnown: w.visibilityKnown === true,
      temperature: Number(w.temperature) || 12,
      pop: Number(w.pop) || 0,
      pty: Number(w.pty) || 0,
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

  private resolveMoonAt(
    lat: number,
    lng: number,
    cached: MoonData,
    atUtc?: Date,
  ): MoonData {
    const ephemeris = moonStateAtObserver(lat, lng, atUtc);
    return {
      phase: cached.phase > 0 ? cached.phase : ephemeris.phase,
      altitude: ephemeris.altitude,
      moonAltitudeKnown: true,
    };
  }

  private buildRawWeatherSnapshot(input: StarIndexInput): WeatherSnapshot {
    const { weather, dust, moon, bortleClass, elevationM, lat, lng } = input;
    const skyCode = weather.skyCode;
    const sunAltDeg = sunAltitudeAtObserver(lat, lng, input.atUtc ?? new Date());
    const precipScore = calcPrecipitationScore(weather.pty, weather.pop);

    return {
      cloud_score: calcCloudScore(weather.cloud),
      pm25_score: calcPm25Score(dust.pm25),
      light_pollution_score: calcLightPollutionScore(bortleClass),
      moon_effect_score: calcMoonEffectScore(
        moon.phase,
        moon.altitude,
        moon.moonAltitudeKnown,
        MOON_ALTITUDE_MISSING_SENTINEL,
      ),
      humidity_score: calcHumidityHazeScore(weather.humidity, dust.pm25),
      elevation_score: calcElevationScore(elevationM),
      wind_score: calcWindSeeingScore(weather.windSpeed),
      visibility_score: calcVisibilityScore(
        weather.visibility,
        weather.visibilityKnown,
      ),
      temperature_score: calcTemperatureNeutralScore(),
      correction_score: input.correctionScore ?? 100,
      precipitation_probability: weather.pop,
      precipitation_type: weather.pty,
      precipitation_score: precipScore,
      visibility_known: weather.visibilityKnown,
      moon_altitude_deg: moon.altitude,
      moon_altitude_known: moon.moonAltitudeKnown,
      lun_phase: moon.phase,
      cloud_sky_code: skyCode,
      cloud_sky_label: skyCodeToLabel(skyCode),
      cloud_cover_pct: weather.cloud,
      pm25_ug_m3: dust.pm25,
      pm25_label: dust.pm25Label,
      pm25_station_name: dust.stationName,
      sun_altitude_deg: sunAltDeg,
      daylight_observation_score: sunAltitudeToObservationScore(sunAltDeg),
    };
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
