import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { StarIndexModule } from '../star-index/star-index.module';
import { SpotReportEntity } from './spot-report.entity';
import { SpotReportsController } from './spot-reports.controller';
import { SpotReportsService } from './spot-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SpotReportEntity]),
    AuthModule,
    StarIndexModule,
  ],
  controllers: [SpotReportsController],
  providers: [SpotReportsService],
  exports: [SpotReportsService],
})
export class SpotReportsModule {}
