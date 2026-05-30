import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OBSERVATION_REPOSITORY } from '../common/interfaces/observation.repository';
import { PHOTO_REPOSITORY } from '../common/interfaces/photo.repository';
import { PhotoEntity } from '../photos/photo.entity';
import { TypeOrmPhotoRepository } from '../photos/typeorm-photo.repository';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { ObservationEntity } from './observation.entity';
import { ObservationService } from './observation.service';
import { ObservationsController } from './observations.controller';
import { TypeOrmObservationRepository } from './typeorm-observation.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([ObservationEntity, PhotoEntity]),
    AuthModule,
  ],
  controllers: [ObservationsController],
  providers: [
    ObservationService,
    SupabaseStorageService,
    TypeOrmObservationRepository,
    TypeOrmPhotoRepository,
    {
      provide: OBSERVATION_REPOSITORY,
      useExisting: TypeOrmObservationRepository,
    },
    {
      provide: PHOTO_REPOSITORY,
      useExisting: TypeOrmPhotoRepository,
    },
  ],
  exports: [ObservationService, OBSERVATION_REPOSITORY],
})
export class ObservationsModule {}
