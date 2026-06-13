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

const GIBS_WMS_BASE =
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

/** 메모리 캐시 TTL · Cache-Control max-age (초) — 동일 bbox 재요청 완화 */
const VIIRS_CACHE_TTL_SEC = 120;

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function isSafeLayerId(layer: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(layer);
}

function requireFinite(n: number, name: string): number {
  if (!Number.isFinite(n)) {
    throw new Error(`invalid ${name}`);
  }
  return n;
}

function buildGibsGetMapUrl(opts: {
  layer: string;
  south: number;
  west: number;
  north: number;
  east: number;
  width: number;
  height: number;
  format: string;
  time?: string;
}): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: opts.layer,
    STYLES: '',
    CRS: 'EPSG:4326',
    BBOX: `${opts.south},${opts.west},${opts.north},${opts.east}`,
    WIDTH: String(opts.width),
    HEIGHT: String(opts.height),
    FORMAT: opts.format,
    TRANSPARENT: 'TRUE',
  });
  if (opts.time) {
    params.set('TIME', opts.time);
  }
  return `${GIBS_WMS_BASE}?${params.toString()}`;
}

function sendRasterOk(
  res: Response,
  format: string,
  buf: Buffer,
): void {
  res.status(200);
  res.setHeader('Content-Type', format);
  res.setHeader('Cache-Control', `public, max-age=${VIIRS_CACHE_TTL_SEC}`);
  res.end(buf);
}

@Controller('viirs')
export class ViirsController {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Kakao 지도 bounds 위에 덮는 WMS 이미지 프록시 (정합 우선).
   * - bbox는 WGS84 경위도 (west,south,east,north)
   * - width/height는 map div 크기 (px)
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
        return sendRasterOk(res, format, cached);
      }

      const url = buildGibsGetMapUrl({
        layer,
        south,
        west,
        north,
        east,
        width: w,
        height: h,
        format,
        time: time || undefined,
      });

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
      await this.cache.set(cacheKey, buf, VIIRS_CACHE_TTL_SEC);
      return sendRasterOk(res, format, buf);
    } catch {
      return res.status(400).json({
        message: '요청 파라미터가 올바르지 않습니다.',
      });
    }
  }
}
