import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 기동 시 JWT 환경변수 검증 — register 중간에 터지는 것 방지 */
@Injectable()
export class AuthEnvValidator implements OnModuleInit {
  private readonly logger = new Logger(AuthEnvValidator.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const access = this.config.get<string>('JWT_SECRET')?.trim();
    const refresh = this.config.get<string>('JWT_REFRESH_SECRET')?.trim();
    if (!access) {
      throw new Error(
        'JWT_SECRET이 비어 있습니다. backend/.env 에 설정하세요.',
      );
    }
    if (!refresh) {
      throw new Error(
        'JWT_REFRESH_SECRET이 비어 있습니다. backend/.env 에 설정하세요.',
      );
    }
    if (access === refresh) {
      this.logger.warn(
        'JWT_SECRET과 JWT_REFRESH_SECRET이 동일합니다. 서로 다른 랜덤 문자열을 권장합니다.',
      );
    }
  }
}
