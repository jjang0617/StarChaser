import { CacheModule } from '@nestjs/cache-manager';
import { Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

const logger = new Logger('AppCacheModule');

/**
 * CACHE_DRIVER=memory (기본) | redis
 * redis 사용 시 REDIS_URL 필수 — 재시작 후에도 weather/dust/moon 유지
 */
export const AppCacheModule = CacheModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const driver = config.get<string>('CACHE_DRIVER', 'memory').toLowerCase();
    const redisUrl = config.get<string>('REDIS_URL')?.trim();
    const ttlSec = Number(config.get<string>('CACHE_TTL', '3600'));
    const ttlMs = Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec * 1000 : 3_600_000;

    if (driver === 'redis' && redisUrl) {
      const { redisStore } = await import('cache-manager-redis-yet');
      logger.log(`캐시 드라이버: redis (${redisUrl.split('@').pop() ?? 'connected'})`);
      return {
        store: await redisStore({
          url: redisUrl,
          ttl: ttlMs,
        }),
      };
    }

    if (driver === 'redis' && !redisUrl) {
      logger.warn('CACHE_DRIVER=redis 이지만 REDIS_URL 없음 — memory 캐시로 폴백');
    }

    return {
      ttl: ttlSec,
      max: 500,
    };
  },
});
