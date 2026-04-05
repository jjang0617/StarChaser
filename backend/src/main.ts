import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.useGlobalFilters(new AllExceptionsFilter());

  // 전역 ValidationPipe — DTO 유효성 검사
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // DTO에 없는 필드 자동 제거
      forbidNonWhitelisted: true,
      transform: true,        // 타입 자동 변환
    }),
  );

  // CORS — 개발 환경에서 Expo 허용
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://starchaser.app']
      : true,
  });

  // Windows에서 3000번 EACCES(시스템 예약·Hyper-V 등)가 나오면 PORT=3333 등으로 변경
  const port = Number(process.env.PORT ?? 3333);
  // 로컬은 127.0.0.1 — 배포(Railway 등)는 NODE_ENV=production일 때 0.0.0.0
  const host =
    process.env.HOST ??
    (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

  // Swagger API 문서 (개발 환경에서만)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('StarChaser API')
      .setDescription('별 관측 성공 확률(Star-Index) 앱 API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
    logger.log(`Swagger: http://localhost:${port}/api-docs`);
  }

  await app.listen(port, host);
  logger.log(`🚀 StarChaser API on http://${host}:${port}`);
}

bootstrap();
