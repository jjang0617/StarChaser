import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sanitizeClientErrorMessage } from '../sanitize-client-error.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const rawMessage =
        typeof res === 'string'
          ? res
          : typeof res === 'object' && res !== null && 'message' in res
            ? (res as { message: string | string[] }).message
            : undefined;
      const message = sanitizeClientErrorMessage(status, rawMessage);
      response.status(status).json({
        statusCode: status,
        message,
      });
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
      message: sanitizeClientErrorMessage(500, undefined),
    });
  }
}
