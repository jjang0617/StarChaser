import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 개발 환경에서 DB·설정 오류 원인을 응답에 포함 (프로덕션은 메시지 숨김)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const body =
        typeof res === 'string'
          ? { statusCode: status, message: res, path: request.url }
          : { statusCode: status, ...(res as object), path: request.url };
      response.status(status).json(body);
      return;
    }

    const err =
      exception instanceof Error ? exception : new Error('Unknown error');
    this.logger.error(`${request.method} ${request.url} — ${err.message}`);
    if (err.stack) {
      this.logger.error(err.stack);
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProd ? 'Internal server error' : err.message,
      path: request.url,
    });
  }
}
