// ──────────────────────────────────────────────────────────────
// Star-Index 모듈 — 장성재(A) 담당
// 10개 변수 가중치 계산 알고리즘
// ──────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CorrectionsModule } from '../corrections/corrections.module';
import { SpotsModule } from '../spots/spots.module';
import { CacheHydrationModule } from '../cache-hydration/cache-hydration.module';
import { StarIndexController } from './star-index.controller';
import { StarIndexService } from './star-index.service';
import { StarIndexInputCacheReader } from './star-index-input-cache.reader';
import { StarIndexSpotScoreCacheService } from './star-index-spot-score-cache.service';

@Module({
  imports: [
    AuthModule,
    SpotsModule,
    CorrectionsModule,
    CacheHydrationModule,
  ],
  controllers: [StarIndexController],
  providers: [
    StarIndexService,
    StarIndexInputCacheReader,
    StarIndexSpotScoreCacheService,
  ],
  exports: [StarIndexService],
})
export class StarIndexModule {}
