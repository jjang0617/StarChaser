import { Module } from '@nestjs/common';
import { SkyService } from './sky.service';
import { SkyController } from './sky.controller';

@Module({
  providers: [SkyService],
  controllers: [SkyController]
})
export class SkyModule {}
