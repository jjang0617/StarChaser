import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

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
    logger.log('Swagger: http://localhost:3000/api-docs');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 StarChaser API running on port ${port}`);
}

bootstrap();
