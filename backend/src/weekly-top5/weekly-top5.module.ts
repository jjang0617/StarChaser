import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WEEKLY_TOP5_REPOSITORY } from '../common/interfaces/weekly-top5.repository';
import { TypeOrmWeeklyTop5Repository } from './typeorm-weekly-top5.repository';
import { WeeklyTop5Entity } from './weekly-top5.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WeeklyTop5Entity])],
  providers: [
    TypeOrmWeeklyTop5Repository,
    {
      provide: WEEKLY_TOP5_REPOSITORY,
      useExisting: TypeOrmWeeklyTop5Repository,
    },
  ],
  exports: [WEEKLY_TOP5_REPOSITORY],
})
export class WeeklyTop5Module {}
