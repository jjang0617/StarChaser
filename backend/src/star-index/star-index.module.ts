// ──────────────────────────────────────────────────────────────
// Star-Index 모듈 — 장성재(A) 담당
// 10개 변수 가중치 계산 알고리즘
// ──────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { StarIndexController } from './star-index.controller';
import { StarIndexService } from './star-index.service';

@Module({
  controllers: [StarIndexController],
  providers: [StarIndexService],
  exports: [StarIndexService],
})
export class StarIndexModule {}
