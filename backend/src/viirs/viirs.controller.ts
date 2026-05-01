import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { Response } from 'express';
import axios from 'axios';

type WmsQuery = {
  west: string;
  south: string;
  east: string;
  north: string;
  w?: string;
  h?: string;
  time?: string;
  layer?: string;
  format?: string;
};

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function isSafeLayerId(layer: string): boolean {
  // allowlist-ish: capabilities Identifier는 보통 이 문자셋에 들어옴
  return /^[A-Za-z0-9_]+$/.test(layer);
}

function requireFinite(n: number, name: string): number {
  if (!Number.isFinite(n)) {
    throw new Error(`invalid ${name}`);
  }
  return n;
}

@Controller('viirs')
export class ViirsController {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Kakao 지도 bounds 위에 덮는 WMS 이미지 프록시 (정합 우선).
   * - bbox는 WGS84 경위도 (west,south,east,north)
   * - width/height는 map div 크기 (px)
   *
   * NOTE: 인증/레이트리밋/더 긴 캐시는 운영 단계에서 추가.
   */
  @Get('wms')
  async wms(
    @Res() res: Response,
    @Query() q: WmsQuery,
  ) {
    try {
      const west = requireFinite(Number(q.west), 'west');
      const south = requireFinite(Number(q.south), 'south');
      const east = requireFinite(Number(q.east), 'east');
      const north = requireFinite(Number(q.north), 'north');

      const w = clampInt(Number(q.w ?? '1024'), 64, 2048);
      const h = clampInt(Number(q.h ?? '1024'), 64, 2048);

      const time = (q.time ?? '').trim();
      const layer =
        (q.layer ?? 'VIIRS_Black_Marble').trim() ||
        'VIIRS_Black_Marble';
      if (!isSafeLayerId(layer)) {
        return res.status(400).json({ message: 'invalid layer' });
      }

      const format = (q.format ?? 'image/png').trim() || 'image/png';

      const cacheKey = `viirs:wms:${layer}:${time || 'no-time'}:${west}:${south}:${east}:${north}:${w}:${h}:${format}`;
      const cached = (await this.cache.get<Buffer>(cacheKey)) ?? null;
      if (cached) {
        res.status(200);
        res.setHeader('Content-Type', format);
        res.setHeader('Cache-Control', 'public, max-age=120');
        return res.end(cached);
      }

      // GIBS WMS endpoint (EPSG:4326)
      const base = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
      const params = new URLSearchParams({
        SERVICE: 'WMS',
        REQUEST: 'GetMap',
        VERSION: '1.3.0',
        LAYERS: layer,
        STYLES: '',
        CRS: 'EPSG:4326',
        // WMS 1.3.0 + EPSG:4326는 lat,lon 순서
        BBOX: `${south},${west},${north},${east}`,
        WIDTH: String(w),
        HEIGHT: String(h),
        FORMAT: format,
        TRANSPARENT: 'TRUE',
      });
      if (time) {
        params.set('TIME', time);
      }

      const url = `${base}?${params.toString()}`;
      const upstream = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 25_000,
        validateStatus: () => true,
        headers: {
          Accept: format,
          'User-Agent': 'StarChaser/viirs-wms-proxy',
        },
      });

      if (upstream.status !== 200 || !upstream.data) {
        return res.status(502).json({ message: 'upstream_failed' });
      }

      const buf = Buffer.from(upstream.data);
      await this.cache.set(cacheKey, buf, 120);
      res.status(200);
      res.setHeader('Content-Type', format);
      res.setHeader('Cache-Control', 'public, max-age=120');
      return res.end(buf);
    } catch (e) {
      return res.status(400).json({
        message: e instanceof Error ? e.message : 'bad_request',
      });
    }
  }
}

