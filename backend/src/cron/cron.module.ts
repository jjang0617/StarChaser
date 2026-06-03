import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { CronController } from './cron.controller';
import { AuthModule } from '../auth/auth.module';
import { SpotsModule } from '../spots/spots.module';
import { WeeklyTop3Module } from '../weekly-top3/weekly-top3.module';
import { CacheHydrationModule } from '../cache-hydration/cache-hydration.module';

@Module({
  imports: [AuthModule, CacheHydrationModule, SpotsModule, WeeklyTop3Module],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
