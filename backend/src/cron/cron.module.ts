import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { SkyModule } from '../sky/sky.module';
import { CronController } from './cron.controller';
import { SpotsModule } from '../spots/spots.module';
import { WeeklyTop5Module } from '../weekly-top5/weekly-top5.module';

@Module({
  imports: [SkyModule, SpotsModule, WeeklyTop5Module],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
