import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpotsModule } from '../spots/spots.module';
import { AuthModule } from '../auth/auth.module';
import { StarIndexCorrectionSubmissionEntity } from './star-index-correction-submission.entity';
import { CorrectionsService } from './corrections.service';
import { CorrectionsController } from './corrections.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StarIndexCorrectionSubmissionEntity]),
    SpotsModule,
    AuthModule,
  ],
  controllers: [CorrectionsController],
  providers: [CorrectionsService],
  exports: [CorrectionsService],
})
export class CorrectionsModule {}
