import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Astronomy from 'astronomy-engine';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import {
  kasiToInternalMapper,
  MOON_ALTITUDE_MISSING_SENTINEL,
} from './kasi.mapper';
import {
  isAboveHorizon,
  julianDateUT,
  localSiderealDegrees,
  raDecToAltAz,
} from './sky-astronomy.util';

type CatalogRow = {
  hip: number;
  raDeg: number;
  decDeg: number;
  mag: number;
  con: string;
  name?: string;
};

export type ConstellationLineSegmentDto = {
  fromHip: number;
  toHip: number;
  con: string;
};

export type ConstellationLinesResponseDto = {
  epoch: string;
  note?: string;
  segments: ConstellationLineSegmentDto[];
};

/** 달·내행성·목성 — astronomy-engine 지평 좌표 + 가시 등급 */
export type SkyViewBodyDto = {
  id: 'moon' | 'venus' | 'jupiter';
  labelKo: string;
  azDeg: number;
  altDeg: number;
  magnitude: number;
  visible: boolean;
  /** 달만 — 조명 비율 0~1 (Illumination.phase_fraction) */
  phaseFraction?: number;
  /** 달만 — 0° 근처 신월 … Astronomy.MoonPhase (°) */
  moonPhaseDeg?: number;
};

type KasiApiEnvelope = {
  response?: {
    body?: {
      items?: {
        item?: Record<string, unknown> | Record<string, unknown>[];
      };
    };
  };
};

@Injectable()
export class SkyService {
  private readonly logger = new Logger(SkyService.name);

  /** hip-bright-subset.json 로드 결과 캐시 */
  private catalogCache: CatalogRow[] | null = null;

  /** constellation-lines-mvp.json 캐시 */
  private constellationLinesCache: ConstellationLinesResponseDto | null = null;

  constructor(private readonly configService: ConfigService) {}

  private async toKasiItem(data: unknown): Promise<Record<string, unknown> | null> {
    let normalized: unknown = data;

    if (typeof data === 'string') {
      const parsed = await parseStringPromise(data, {
        explicitArray: false,
        trim: true,
      });
      normalized = parsed;
    }

    const envelope = normalized as KasiApiEnvelope;
    const item = envelope.response?.body?.items?.item;
    if (!item) {
      return null;
    }

    return Array.isArray(item) ? item[0] ?? null : item;
  }

  async getMoonData(date: string): Promise<{
    moonAltitude: number;
    /** RiseSet 응답에 고도 필드가 없으면 false — moonAltitude는 센티넬(-10) */
    moonAltitudeKnown: boolean;
    lunPhase: number;
    moonrise: string | null;
    moonset: string | null;
    lunAge: number;
  }> {
    const moonApiKey =
      this.configService.get<string>('KASI_MOON_API_KEY') ??
      this.configService.get<string>('KASI_API_KEY');
    const riseSetApiKey =
      this.configService.get<string>('KASI_RISE_SET_API_KEY') ??
      this.configService.get<string>('KASI_API_KEY');

    // 날짜 형식 변환 (20250324 → year=2025, month=03, day=24)
    const solYear = date.slice(0, 4);
    const solMonth = date.slice(4, 6);
    const solDay = date.slice(6, 8);

    try {
      // 1. 달 출몰 시각 API 호출
      const moonResponse = await axios.get(
        'http://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService/getAreaRiseSetInfo',
        {
          params: {
            ServiceKey: riseSetApiKey,
            locdate: date,
            location: '서울',
          },
        }
      );

      // 2. 월령 정보 API 호출
      const phaseResponse = await axios.get(
        'http://apis.data.go.kr/B090041/openapi/service/LunPhInfoService/getLunPhInfo',
        {
          params: {
            ServiceKey: moonApiKey,
            solYear,
            solMonth,
            solDay,
          },
        }
      );

      // JSON/XML 응답을 모두 처리해 item을 추출
      const moonData = await this.toKasiItem(moonResponse.data);
      const phaseData = await this.toKasiItem(phaseResponse.data);

      // 매핑 함수로 변환
      const result = kasiToInternalMapper(moonData, phaseData);

      if (!result.moonAltitudeKnown) {
        this.logger.warn(
          `[KASI] RiseSet item에 고도 필드 없음 — moonAltitude=${result.moonAltitude}(센티넬). ` +
            `실측 고도는 별도 API/필드 합의 후 kasi.mapper 확장 필요. date=${date}`,
        );
      } else {
        this.logger.log(
          `달 데이터 파싱 완료 — date=${date}, moonAltitude=${result.moonAltitude}(KASI), lunPhase=${result.lunPhase}, lunAge=${result.lunAge}`,
        );
      }

      return result;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`KASI API 호출 실패: ${message}`);
      // 실패 시 기본값 반환 (달이 없는 것으로 처리)
      return {
        moonAltitude: MOON_ALTITUDE_MISSING_SENTINEL,
        moonAltitudeKnown: false,
        lunPhase: 0,
        moonrise: null,
        moonset: null,
        lunAge: 0,
      };
    }
  }

  /**
   * Hipparcos 번호 기반 밝은 별 부분집합(JSON) — 적경·적위·IAU 별자리 약어
   */
  private loadBrightCatalog(): CatalogRow[] {
    if (this.catalogCache) return this.catalogCache;
    try {
      const p = path.join(__dirname, 'data', 'hip-bright-subset.json');
      const raw = fs.readFileSync(p, 'utf8');
      const rows = JSON.parse(raw) as CatalogRow[];
      this.catalogCache = rows;
      this.logger.log(`천체 카탈로그 로드 — ${rows.length}행 (${p})`);
      return rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `hip-bright-subset.json 로드 실패(${msg}) — 내장 최소 목록으로 대체`,
      );
      this.catalogCache = [
        { hip: 49669, raDeg: 101.2872, decDeg: -16.7161, mag: -1.46, con: 'CMa', name: 'Sirius' },
        { hip: 91262, raDeg: 279.2347, decDeg: 38.7837, mag: 0.03, con: 'Lyr', name: 'Vega' },
        { hip: 32349, raDeg: 78.6344, decDeg: -8.2016, mag: 0.13, con: 'Ori', name: 'Rigel' },
      ];
      return this.catalogCache;
    }
  }

  /**
   * MVP 정적 별 목록 — Hipparcos 부분집합과 동일 소스(시각·위치 미반영)
   */
  getStaticStarsMvp(): {
    stars: { id: string; raDeg: number; decDeg: number; mag: number }[];
  } {
    const rows = this.loadBrightCatalog();
    return {
      stars: rows.map((r) => ({
        id: String(r.hip),
        raDeg: r.raDeg,
        decDeg: r.decDeg,
        mag: r.mag,
      })),
    };
  }

  /**
   * 관측자 위도·경도·시각(UT) 기준 지평선 상 별 위치 + 별자리 라벨(가시 별 2개+ 별군만)
   */
  buildSkyView(
    latDeg: number,
    lngDeg: number,
    atUtc: Date,
  ): {
    at: string;
    lat: number;
    lng: number;
    jd: number;
    lstDeg: number;
    stars: Array<{
      hip: number;
      name: string | null;
      con: string;
      raDeg: number;
      decDeg: number;
      mag: number;
      altDeg: number;
      azDeg: number;
      visible: boolean;
    }>;
    constellationLabels: Array<{
      con: string;
      altDeg: number;
      azDeg: number;
    }>;
    bodies: SkyViewBodyDto[];
    ephemerisSource: string;
  } {
    const jd = julianDateUT(atUtc);
    const lstDeg = localSiderealDegrees(jd, lngDeg);
    const rows = this.loadBrightCatalog();

    const stars = rows.map((s) => {
      const { altDeg, azDeg } = raDecToAltAz(s.raDeg, s.decDeg, latDeg, lstDeg);
      const visible = isAboveHorizon(altDeg);
      return {
        hip: s.hip,
        name: s.name ?? null,
        con: s.con,
        raDeg: Math.round(s.raDeg * 1e6) / 1e6,
        decDeg: Math.round(s.decDeg * 1e6) / 1e6,
        mag: s.mag,
        altDeg: Math.round(altDeg * 100) / 100,
        azDeg: Math.round(azDeg * 100) / 100,
        visible,
      };
    });

    const groups = new Map<
      string,
      { sumAzW: number; sumAltW: number; sumW: number; count: number }
    >();
    for (const st of stars) {
      if (!st.visible) continue;
      const w = Math.pow(10, -0.4 * st.mag);
      const g = groups.get(st.con) ?? {
        sumAzW: 0,
        sumAltW: 0,
        sumW: 0,
        count: 0,
      };
      g.sumAzW += st.azDeg * w;
      g.sumAltW += st.altDeg * w;
      g.sumW += w;
      g.count += 1;
      groups.set(st.con, g);
    }

    const constellationLabels: Array<{
      con: string;
      altDeg: number;
      azDeg: number;
    }> = [];
    for (const [con, g] of groups) {
      if (g.count < 2 || g.sumW <= 0) continue;
      constellationLabels.push({
        con,
        azDeg: Math.round((g.sumAzW / g.sumW) * 100) / 100,
        altDeg: Math.round((g.sumAltW / g.sumW) * 100) / 100,
      });
    }
    constellationLabels.sort((a, b) => a.con.localeCompare(b.con));
    const maxLabels = 14;
    const labelsTop = constellationLabels.slice(0, maxLabels);
    const bodies = this.buildSolarSystemBodies(atUtc, latDeg, lngDeg);

    return {
      at: atUtc.toISOString(),
      lat: latDeg,
      lng: lngDeg,
      jd: Math.round(jd * 1e6) / 1e6,
      lstDeg: Math.round(lstDeg * 1000) / 1000,
      stars,
      constellationLabels: labelsTop,
      bodies,
      ephemerisSource: 'astronomy-engine',
    };
  }

  /**
   * 달·금성·목성 — VSOP / 내장 lunar theory 기반 지평선 상 방위·고도 (대기 굴절 normal).
   */
  private buildSolarSystemBodies(
    atUtc: Date,
    latDeg: number,
    lngDeg: number,
  ): SkyViewBodyDto[] {
    const observer = new Astronomy.Observer(latDeg, lngDeg, 0);
    const specs: Array<{
      body: Astronomy.Body;
      id: SkyViewBodyDto['id'];
      labelKo: string;
    }> = [
      { body: Astronomy.Body.Moon, id: 'moon', labelKo: '달' },
      { body: Astronomy.Body.Venus, id: 'venus', labelKo: '금성' },
      { body: Astronomy.Body.Jupiter, id: 'jupiter', labelKo: '목성' },
    ];

    let moonPhaseDeg: number | undefined;
    try {
      moonPhaseDeg = Astronomy.MoonPhase(atUtc);
    } catch {
      moonPhaseDeg = undefined;
    }

    const out: SkyViewBodyDto[] = [];

    for (const { body, id, labelKo } of specs) {
      try {
        const eq = Astronomy.Equator(body, atUtc, observer, true, true);
        const hor = Astronomy.Horizon(atUtc, observer, eq.ra, eq.dec, 'normal');
        const ill = Astronomy.Illumination(body, atUtc);
        const altDeg = Math.round(hor.altitude * 100) / 100;
        const azDeg = Math.round(hor.azimuth * 100) / 100;
        const visible = isAboveHorizon(altDeg);
        const row: SkyViewBodyDto = {
          id,
          labelKo,
          azDeg,
          altDeg,
          magnitude: Math.round(ill.mag * 100) / 100,
          visible,
        };
        if (id === 'moon') {
          row.phaseFraction = Math.round(ill.phase_fraction * 1000) / 1000;
          if (moonPhaseDeg !== undefined) {
            row.moonPhaseDeg = Math.round(moonPhaseDeg * 1000) / 1000;
          }
        }
        out.push(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`태양계 천체 ${id} 계산 실패: ${msg}`);
      }
    }

    return out;
  }

  /**
   * 별자리 연결선(HIP 쌍) — 정적 MVP. 향후 epoch·LOD는 쿼리로 확장 가능.
   */
  getConstellationLines(): ConstellationLinesResponseDto {
    if (this.constellationLinesCache) return this.constellationLinesCache;
    try {
      const p = path.join(__dirname, 'data', 'constellation-lines-mvp.json');
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw) as ConstellationLinesResponseDto;
      this.constellationLinesCache = parsed;
      this.logger.log(`별자리 선 세그먼트 로드 — ${parsed.segments?.length ?? 0}개 (${p})`);
      return parsed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`constellation-lines-mvp.json 로드 실패(${msg}) — 빈 목록 반환`);
      return { epoch: 'J2000', segments: [] };
    }
  }
}