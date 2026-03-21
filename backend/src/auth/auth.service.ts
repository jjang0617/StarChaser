import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;

  // ── 비밀번호 해싱 ─────────────────────────────────────────
  async hashPassword(password: string): Promise<string> {
    const hashed = await bcrypt.hash(password, this.SALT_ROUNDS);
    this.logger.log('비밀번호 해싱 완료');
    return hashed;
  }

  // ── 비밀번호 검증 ─────────────────────────────────────────
  async comparePassword(password: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(password, hashed);
  }
}