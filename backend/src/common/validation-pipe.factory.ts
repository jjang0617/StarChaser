import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { sanitizeClientErrorMessage } from './sanitize-client-error.util';

export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      const first = errors[0];
      const constraints = first?.constraints
        ? Object.values(first.constraints)
        : [];
      const raw = constraints[0];
      return new BadRequestException({
        statusCode: 400,
        message: sanitizeClientErrorMessage(400, raw),
      });
    },
  });
}
