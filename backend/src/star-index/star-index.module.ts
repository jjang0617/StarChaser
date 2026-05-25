// ──────────────────────────────────────────────────────────────
// Star-Index 모듈 — 장성재(A) 담당
// 10개 변수 가중치 계산 알고리즘
// ──────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CorrectionsModule } from '../corrections/corrections.module';
import { SpotsModule } from '../spots/spots.module';
import { CacheHydrationModule } from '../cache-hydration/cache-hydration.module';
import { SpotStarIndexDailyEntity } from '../weekly-top3/spot-star-index-daily.entity';
import { StarIndexController } from './star-index.controller';
import { StarIndexService } from './star-index.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SpotStarIndexDailyEntity]),
    AuthModule,
    SpotsModule,
    CorrectionsModule,
    CacheHydrationModule,
  ],
  controllers: [StarIndexController],
  providers: [StarIndexService],
  exports: [StarIndexService],
})
export class StarIndexModule {}
