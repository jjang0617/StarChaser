import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type JwtValidatedUser = { userId: string; email: string };

type AccessPayload = {
  sub: string;
  email: string;
};

/** Authorization: Bearer <access JWT> 검증 — access 전용 시크릿 사용 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다. .env를 확인하세요.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: AccessPayload): JwtValidatedUser {
    return { userId: payload.sub, email: payload.email };
  }
}
