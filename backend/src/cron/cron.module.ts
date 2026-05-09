import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';
import { SpotsModule } from '../spots/spots.module';
import { WeeklyTop5Module } from '../weekly-top5/weekly-top5.module';
import { CacheHydrationModule } from '../cache-hydration/cache-hydration.module';

@Module({
  imports: [CacheHydrationModule, SpotsModule, WeeklyTop5Module],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
