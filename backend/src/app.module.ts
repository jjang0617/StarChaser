import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CronModule } from './cron/cron.module';
import { SpotsModule } from './spots/spots.module';
import { StarIndexModule } from './star-index/star-index.module';
import { SkyModule } from './sky/sky.module';
import { ObservationsModule } from './observations/observations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CorrectionsModule } from './corrections/corrections.module';
import { ViirsModule } from './viirs/viirs.module';
import { WeeklyTop3Module } from './weekly-top3/weekly-top3.module';
import { KakaoPageController } from './kakao-page.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      /**
       * 1) 컴파일 결과 기준 backend/.env — cwd 와 무관하게 동일 서버 설정.
       * 2) cwd 의 .env / 레포 루트에서 실행 시 backend/.env 보조.
       * dotenv 는 이미 설정된 키를 나중 파일에서 덮어쓰지 않으므로, 가장 신뢰할 소스를 앞에 둠.
       */
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(process.cwd(), '.env'),
        join(process.cwd(), 'backend', '.env'),
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        ssl: { rejectUnauthorized: false },
        logging: config.get('NODE_ENV') === 'development',
        retryAttempts: 3,
        retryDelay: 3000,
        connectTimeoutMS: 3000,
      }),
      inject: [ConfigService],
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 3600,
      max: 500,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 6000,
        limit: 30,
      },
    ]),
    AuthModule,
    CronModule,
    SpotsModule,
    StarIndexModule,
    SkyModule,
    ObservationsModule,
    NotificationsModule,
    CorrectionsModule,
    ViirsModule,
    WeeklyTop3Module,
  ],
  controllers: [AppController, KakaoPageController],
  providers: [AppService],
})
export class AppModule {}