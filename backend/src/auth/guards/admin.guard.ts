import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtValidatedUser } from '../strategies/jwt.strategy';

/** ADMIN_EMAILS(쉼표 구분)에 포함된 JWT 사용자만 허용 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: JwtValidatedUser }>();
    const user = req.user;
    if (!user?.email) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }

    const raw = this.config.get<string>('ADMIN_EMAILS') ?? '';
    const allowed = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.length) {
      throw new ForbiddenException('ADMIN_EMAILS가 설정되지 않았습니다.');
    }
    if (!allowed.includes(user.email.toLowerCase())) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }
    return true;
  }
}
