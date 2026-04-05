import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SPOT_REPOSITORY } from '../common/interfaces/spot.repository';
import { SpotEntity } from './spot.entity';
import { SpotsController } from './spots.controller';
import { TypeOrmSpotRepository } from './typeorm-spot.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([SpotEntity]), AuthModule],
  controllers: [SpotsController],
  providers: [
    TypeOrmSpotRepository,
    { provide: SPOT_REPOSITORY, useExisting: TypeOrmSpotRepository },
  ],
  exports: [SPOT_REPOSITORY],
})
export class SpotsModule {}
