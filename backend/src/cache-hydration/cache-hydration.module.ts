import { Module } from '@nestjs/common';
import { SkyModule } from '../sky/sky.module';
import { StarIndexCacheHydrationService } from './star-index-cache-hydration.service';

@Module({
  imports: [SkyModule],
  providers: [StarIndexCacheHydrationService],
  exports: [StarIndexCacheHydrationService],
})
export class CacheHydrationModule {}
