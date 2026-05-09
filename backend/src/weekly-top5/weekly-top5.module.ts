import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SpotsModule } from '../spots/spots.module';
import { StarIndexModule } from '../star-index/star-index.module';
import { WEEKLY_TOP5_REPOSITORY } from '../common/interfaces/weekly-top5.repository';
import { TypeOrmWeeklyTop5Repository } from './typeorm-weekly-top5.repository';
import { WeeklyTop5Entity } from './weekly-top5.entity';
import { SpotStarIndexDailyEntity } from './spot-star-index-daily.entity';
import { WeeklyTop5Controller } from './weekly-top5.controller';
import { WeeklyTop5Service } from './weekly-top5.service';
import { WeeklyTop5AggregationService } from './weekly-top5-aggregation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeeklyTop5Entity, SpotStarIndexDailyEntity]),
    SpotsModule,
    AuthModule,
    StarIndexModule,
  ],
  controllers: [WeeklyTop5Controller],
  providers: [
    TypeOrmWeeklyTop5Repository,
    {
      provide: WEEKLY_TOP5_REPOSITORY,
      useExisting: TypeOrmWeeklyTop5Repository,
    },
    WeeklyTop5Service,
    WeeklyTop5AggregationService,
  ],
  exports: [
    WEEKLY_TOP5_REPOSITORY,
    WeeklyTop5AggregationService,
    WeeklyTop5Service,
  ],
})
export class WeeklyTop5Module {}
