import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StarIndexCacheRefreshService } from './star-index-cache-refresh.service';

@Injectable()
export class StarIndexCacheBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StarIndexCacheBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly refresh: StarIndexCacheRefreshService,
  ) {}

  onApplicationBootstrap(): void {
    const enabled =
      this.config.get<string>('STAR_INDEX_WARM_ON_STARTUP', 'true') !== 'false';
    if (!enabled) {
      this.logger.log('STAR_INDEX_WARM_ON_STARTUP=false — 기동 워밍 생략');
      return;
    }

    setImmediate(() => {
      void this.refresh.warmOnStartup().catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[CacheWarm] 기동 워밍 예외: ${msg}`);
      });
    });
  }
}
