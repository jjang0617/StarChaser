import { Module } from '@nestjs/common';
import { SpotsModule } from '../spots/spots.module';
import { StarIndexCacheHydrationService } from './star-index-cache-hydration.service';

@Module({
  imports: [SpotsModule],
  providers: [StarIndexCacheHydrationService],
  exports: [StarIndexCacheHydrationService],
})
export class CacheHydrationModule {}
