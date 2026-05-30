import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ObservationReportsModule } from '../observation-reports/observation-reports.module';
import { SpotReportsModule } from '../spot-reports/spot-reports.module';
import { AdminObservationReportsController } from './admin-observation-reports.controller';
import { AdminSpotReportsController } from './admin-spot-reports.controller';

@Module({
  imports: [AuthModule, ObservationReportsModule, SpotReportsModule],
  controllers: [AdminObservationReportsController, AdminSpotReportsController],
})
export class AdminModule {}
