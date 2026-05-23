import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SpotsModule } from '../spots/spots.module';
import { StarIndexModule } from '../star-index/star-index.module';
import { WEEKLY_TOP3_REPOSITORY } from '../common/interfaces/weekly-top3.repository';
import { TypeOrmWeeklyTop3Repository } from './typeorm-weekly-top3.repository';
import { WeeklyTop3Entity } from './weekly-top3.entity';
import { SpotStarIndexDailyEntity } from './spot-star-index-daily.entity';
import { WeeklyTop3Controller } from './weekly-top3.controller';
import { WeeklyTop3Service } from './weekly-top3.service';
import { WeeklyTop3AggregationService } from './weekly-top3-aggregation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeeklyTop3Entity, SpotStarIndexDailyEntity]),
    SpotsModule,
    AuthModule,
    StarIndexModule,
  ],
  controllers: [WeeklyTop3Controller],
  providers: [
    TypeOrmWeeklyTop3Repository,
    {
      provide: WEEKLY_TOP3_REPOSITORY,
      useExisting: TypeOrmWeeklyTop3Repository,
    },
    WeeklyTop3Service,
    WeeklyTop3AggregationService,
  ],
  exports: [
    WEEKLY_TOP3_REPOSITORY,
    WeeklyTop3AggregationService,
    WeeklyTop3Service,
  ],
})
export class WeeklyTop3Module {}
