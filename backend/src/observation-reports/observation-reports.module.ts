import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ObservationsModule } from '../observations/observations.module';
import { ObservationMismatchReportEntity } from './observation-mismatch-report.entity';
import { ObservationReportsController } from './observation-reports.controller';
import { ObservationReportsService } from './observation-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ObservationMismatchReportEntity]),
    AuthModule,
    ObservationsModule,
  ],
  controllers: [ObservationReportsController],
  providers: [ObservationReportsService],
  exports: [ObservationReportsService],
})
export class ObservationReportsModule {}
