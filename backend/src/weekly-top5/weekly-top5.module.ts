import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SpotsModule } from '../spots/spots.module';
import { WEEKLY_TOP5_REPOSITORY } from '../common/interfaces/weekly-top5.repository';
import { TypeOrmWeeklyTop5Repository } from './typeorm-weekly-top5.repository';
import { WeeklyTop5Entity } from './weekly-top5.entity';
import { WeeklyTop5Controller } from './weekly-top5.controller';
import { WeeklyTop5Service } from './weekly-top5.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeeklyTop5Entity]),
    SpotsModule,
    AuthModule,
  ],
  controllers: [WeeklyTop5Controller],
  providers: [
    TypeOrmWeeklyTop5Repository,
    {
      provide: WEEKLY_TOP5_REPOSITORY,
      useExisting: TypeOrmWeeklyTop5Repository,
    },
    WeeklyTop5Service,
  ],
  exports: [WEEKLY_TOP5_REPOSITORY],
})
export class WeeklyTop5Module {}
