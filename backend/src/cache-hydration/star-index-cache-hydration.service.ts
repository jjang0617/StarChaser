import { Injectable } from '@nestjs/common';
import { AirkoreaStationCatalogService } from './airkorea-station-catalog.service';
import { StarIndexExternalCacheWriterService } from './star-index-external-cache-writer.service';
import type { AirKoreaStationCatalogEntry } from './airkorea-station.util';

/**
 * Star-Index에 필요한 weather / dust / moon 키를 요청 시·cron 시 채움.
 * (CronModule ↔ StarIndexModule 순환 의존 방지용 분리)
 */
@Injectable()
export class StarIndexCacheHydrationService {
  constructor(
    private readonly stationCatalog: AirkoreaStationCatalogService,
    private readonly externalCacheWriter: StarIndexExternalCacheWriterService,
  ) {}

  latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
    return this.externalCacheWriter.latLngToGrid(lat, lng);
  }

  async getInputCacheStatus(
    lat: number,
    lng: number,
    fixedDustStationName?: string | null,
  ): Promise<{
    weatherKey: string;
    dustKey: string;
    moonKey: string;
    weatherExists: boolean;
    dustExists: boolean;
    moonExists: boolean;
  }> {
    return this.externalCacheWriter.getInputCacheStatus(
      lat,
      lng,
      fixedDustStationName,
    );
  }

  async getStationCatalogCached(): Promise<AirKoreaStationCatalogEntry[]> {
    return this.stationCatalog.getStationCatalogCached();
  }

  async ensureStationCatalog(): Promise<void> {
    return this.stationCatalog.ensureStationCatalog();
  }

  async resolveNearestStation(
    lat: number,
    lng: number,
  ): Promise<AirKoreaStationCatalogEntry> {
    return this.stationCatalog.resolveNearestStation(lat, lng);
  }

  resolveNearestStationFast(
    lat: number,
    lng: number,
    catalog: AirKoreaStationCatalogEntry[],
  ): AirKoreaStationCatalogEntry {
    return this.stationCatalog.resolveNearestStationFast(lat, lng, catalog);
  }

  async resolveDustCacheKey(
    lat: number,
    lng: number,
    fixedStationName?: string | null,
  ): Promise<string> {
    return this.stationCatalog.resolveDustCacheKey(lat, lng, fixedStationName);
  }

  async ensureForStarIndexBatch(
    locations: {
      lat: number;
      lng: number;
      dustStationName?: string | null;
    }[],
  ): Promise<void> {
    return this.externalCacheWriter.ensureForStarIndexBatch(locations);
  }

  async fetchAndStoreWeatherGrid(nx: number, ny: number): Promise<void> {
    return this.externalCacheWriter.fetchAndStoreWeatherGrid(nx, ny);
  }

  async fetchAndStoreDustForSido(sidoName: string): Promise<void> {
    return this.externalCacheWriter.fetchAndStoreDustForSido(sidoName);
  }

  async fetchAndStoreDustForStation(stationName: string): Promise<void> {
    return this.externalCacheWriter.fetchAndStoreDustForStation(stationName);
  }

  async fetchAndStoreMoonKstToday(
    observerLat?: number,
    observerLng?: number,
  ): Promise<void> {
    return this.externalCacheWriter.fetchAndStoreMoonKstToday(
      observerLat,
      observerLng,
    );
  }

  async ensureForStarIndexRequest(
    lat: number,
    lng: number,
    fixedDustStationName?: string | null,
  ): Promise<void> {
    return this.externalCacheWriter.ensureForStarIndexRequest(
      lat,
      lng,
      fixedDustStationName,
    );
  }

  async fetchAndStoreDustForAllSpots(): Promise<void> {
    return this.externalCacheWriter.fetchAndStoreDustForAllSpots();
  }
}
