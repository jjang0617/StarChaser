import { Module } from '@nestjs/common';
import { SpotsModule } from '../spots/spots.module';
import { AirkoreaStationCatalogService } from './airkorea-station-catalog.service';
import { StarIndexCacheBootstrapService } from './star-index-cache-bootstrap.service';
import { StarIndexCacheHydrationService } from './star-index-cache-hydration.service';
import { StarIndexCacheRefreshService } from './star-index-cache-refresh.service';
import { StarIndexExternalCacheWriterService } from './star-index-external-cache-writer.service';

@Module({
  imports: [SpotsModule],
  providers: [
    AirkoreaStationCatalogService,
    StarIndexExternalCacheWriterService,
    StarIndexCacheHydrationService,
    StarIndexCacheRefreshService,
    StarIndexCacheBootstrapService,
  ],
  exports: [
    StarIndexCacheHydrationService,
    StarIndexCacheRefreshService,
  ],
})
export class CacheHydrationModule {}
