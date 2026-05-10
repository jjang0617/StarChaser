import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface AstronomyCatalogEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  windowStart: string;
  windowEnd: string;
}

interface StaticFileShape {
  events: AstronomyCatalogEvent[];
}

/**
 * Phase 5 MVP: 정적 JSON 천체 이벤트 카탈로그.
 * 추후 API·DB로 교체 가능.
 */
@Injectable()
export class AstronomyEventsCatalogService {
  private readonly logger = new Logger(AstronomyEventsCatalogService.name);
  private cache: AstronomyCatalogEvent[] | null = null;

  /** 현재 시각이 [windowStart, windowEnd] 안에 있는 이벤트만 */
  getActiveEvents(now: Date = new Date()): AstronomyCatalogEvent[] {
    const all = this.loadAll();
    return all.filter((e) => {
      const start = new Date(e.windowStart).getTime();
      const end = new Date(e.windowEnd).getTime();
      const t = now.getTime();
      return t >= start && t <= end;
    });
  }

  private loadAll(): AstronomyCatalogEvent[] {
    if (this.cache) return this.cache;
    try {
      const path = join(__dirname, 'data', 'astronomy-events.static.json');
      const raw = readFileSync(path, 'utf8');
      const parsed = JSON.parse(raw) as StaticFileShape;
      if (!Array.isArray(parsed.events)) {
        this.cache = [];
        return this.cache;
      }
      this.cache = parsed.events;
      return this.cache;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`천체 이벤트 카탈로그 로드 실패: ${msg}`);
      this.cache = [];
      return this.cache;
    }
  }
}
