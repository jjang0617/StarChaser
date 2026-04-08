import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import {
  kasiToInternalMapper,
  MOON_ALTITUDE_MISSING_SENTINEL,
} from './kasi.mapper';

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
}