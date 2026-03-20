import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

// ──────────────────────────────────────────────────────────────
// Cron 수집기 — 장성재(A) 담당
// 외부 API는 앱에서 직접 호출 금지 — 반드시 Cron → CacheService → 앱
// ──────────────────────────────────────────────────────────────

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  // ── 기상청 단기예보 — 매 1시간마다 수집 ─────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async collectWeatherData() {
    this.logger.log('기상청 API 수집 시작...');
    // TODO: 장성재(A) 3주차 구현
    // 1. 전국 주요 격자 목록 조회
    // 2. 기상청 단기예보 API 호출 (KMA_API_KEY)
    // 3. cache.set(`weather:${gridX}:${gridY}`, data, 3600)
  }

  // ── 에어코리아 PM2.5 — 매 1시간마다 수집 ─────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async collectDustData() {
    this.logger.log('에어코리아 API 수집 시작...');
    // TODO: 장성재(A) 3주차 구현
    // cache.set(`dust:${sido}`, data, 3600)
  }

  // ── KASI 달 데이터 — 매일 자정 수집 ─────────────────────────
  @Cron('0 0 * * *')
  async collectMoonData() {
    this.logger.log('KASI 달 고도·위상 수집 시작...');
    // TODO: 지영재(C)와 협력 — 달 고도(moonAltitude) 필드 확인 필수
    // cache.set(`moon:${date}`, data, 86400)
  }

  // ── 주간 TOP5 — 매주 월요일 오전 7시 갱신 ────────────────────
  @Cron('0 7 * * 1')
  async calcWeeklyTop5() {
    this.logger.log('주간 TOP5 산출 시작...');
    // TODO: 김세희(B) — 5주차 구현
    // cache.set(`top5:weekly:${week}`, data, 86400)
  }
}
