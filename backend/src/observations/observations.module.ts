import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OBSERVATION_REPOSITORY } from '../common/interfaces/observation.repository';
import { ObservationEntity } from './observation.entity';
import { ObservationService } from './observation.service';
import { ObservationsController } from './observations.controller';
import { TypeOrmObservationRepository } from './typeorm-observation.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ObservationEntity]), AuthModule],
  controllers: [ObservationsController],
  providers: [
    ObservationService,
    TypeOrmObservationRepository,
    {
      provide: OBSERVATION_REPOSITORY,
      useExisting: TypeOrmObservationRepository,
    },
  ],
  exports: [ObservationService, OBSERVATION_REPOSITORY],
})
export class ObservationsModule {}
