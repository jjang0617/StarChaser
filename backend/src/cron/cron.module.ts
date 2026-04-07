import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { SkyModule } from '../sky/sky.module';
import { CronController } from './cron.controller';
import { SpotsModule } from '../spots/spots.module';

@Module({
  imports: [SkyModule, SpotsModule],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
