import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkyService } from './sky.service';
import { SkyController } from './sky.controller';

@Module({
  imports: [AuthModule],
  providers: [SkyService],
  controllers: [SkyController],
  exports: [SkyService],
})
export class SkyModule {}
