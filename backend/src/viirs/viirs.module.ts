import { Module } from '@nestjs/common';
import { ViirsController } from './viirs.controller';

@Module({
  controllers: [ViirsController],
})
export class ViirsModule {}

