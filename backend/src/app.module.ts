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

@Module({
  imports: [
    // ── 환경변수 — 전역 사용 ──────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ── DB (Supabase PostgreSQL + PostGIS) ──────────── DB적용후 주석처리 빼기
// TypeOrmModule.forRootAsync({
//   imports: [ConfigModule],
//   useFactory: (config: ConfigService) => ({
//     type: 'postgres',
//     url: config.get<string>('DATABASE_URL'),
//     autoLoadEntities: true,
//     synchronize: false,
//     ssl: { rejectUnauthorized: false },
//     logging: config.get('NODE_ENV') === 'development',
//     retryAttempts: 3,
//     retryDelay: 3000,
//     connectTimeoutMS: 3000,
//   }),
//   inject: [ConfigService],
// }),

    // ── 캐시 (Phase 1: 메모리 / Phase 2: Redis 교체) ──
    // Phase 2 전환 시 여기만 수정하면 됨 — 서비스 코드 불변
    CacheModule.register({
      isGlobal: true,
      ttl: 3600, // 기본 TTL 1시간
      max: 500,  // 최대 캐시 항목 수
    }),

    // ── Cron 스케줄러 ─────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Rate Limit (API 남용 방지) ────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 6000,  // 60초 윈도우
        limit: 30,   // IP당 최대 30회
      },
    ]),

    AuthModule,

    CronModule,

    SpotsModule,

    // ── 기능 모듈 (각 담당자가 채워나감) ─────────────
    // AuthModule,       // 장성재(A) — 2주차
    // StarIndexModule,  // 장성재(A) — 2~3주차
    // SpotsModule,      // 김세희(B) — 3주차
    // ObservationsModule, // 장성재(A) — 5주차
    // SkyModule,        // 지영재(C) — 4주차
    // NotificationsModule, // 지영재(C) — 4~5주차
    // CronModule,       // 장성재(A) — 3주차
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
