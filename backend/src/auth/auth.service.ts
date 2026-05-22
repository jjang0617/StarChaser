import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { UserEntity } from '../users/user.entity';
import { EmailVerificationEntity } from './email-verification.entity';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { RegisterDto } from './dto/register.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

type VerificationPurpose = 'register' | 'reset-password';

type RefreshPayload = { sub: string; type?: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(EmailVerificationEntity)
    private readonly verificationsRepo: Repository<EmailVerificationEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async comparePassword(password: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(password, hashed);
  }

  /* ───── 이메일 중복 확인 ───── */

  async checkEmail(email: string) {
    const existing = await this.usersRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    return { available: !existing };
  }

  /* ───── 닉네임 중복 확인 ───── */

  async checkNickname(nickname: string) {
    const existing = await this.usersRepo.findOne({
      where: { nickname },
    });
    return { available: !existing };
  }

  /* ───── 인증번호 발송 ───── */

  async sendCode(dto: SendCodeDto) {
    const email = dto.email.toLowerCase();

    if (dto.purpose === 'register') {
      const existing = await this.usersRepo.findOne({ where: { email } });
      if (existing) {
        throw new ConflictException('이미 등록된 이메일입니다.');
      }
    }

    if (dto.purpose === 'reset-password') {
      const user = await this.usersRepo.findOne({ where: { email } });
      if (!user) {
        throw new NotFoundException('가입되지 않은 이메일입니다.');
      }
    }

    const code = crypto.randomInt(100000, 999999).toString();

    await this.verificationsRepo.delete({ email, purpose: dto.purpose });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const verification = this.verificationsRepo.create({
      email,
      code,
      purpose: dto.purpose,
      expiresAt,
    });
    await this.verificationsRepo.save(verification);

    await this.sendEmail(email, code, dto.purpose);

    return { message: '인증번호가 발송되었습니다.' };
  }

  /* ───── 인증번호 확인 ───── */

  async verifyCode(dto: VerifyCodeDto) {
    const email = dto.email.toLowerCase();

    const verification = await this.verificationsRepo.findOne({
      where: {
        email,
        purpose: dto.purpose,
        verified: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!verification || verification.code !== dto.code) {
      return { verified: false };
    }

    verification.verified = true;
    await this.verificationsRepo.save(verification);
    return { verified: true };
  }

  /* ───── 회원가입 (이메일 인증 + 닉네임 포함) ───── */

  /** 회원가입 후 access·refresh JWT 발급 및 refresh_token DB 저장 */
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();

    const verification = await this.verificationsRepo.findOne({
      where: { email, purpose: 'register', verified: true },
      order: { createdAt: 'DESC' },
    });
    if (!verification) {
      throw new BadRequestException('이메일 인증이 완료되지 않았습니다.');
    }

    const existingEmail = await this.usersRepo.findOne({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    const existingNickname = await this.usersRepo.findOne({
      where: { nickname: dto.nickname },
    });
    if (existingNickname) {
      throw new ConflictException('이미 사용 중인 닉네임입니다.');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = this.usersRepo.create({
      email,
      passwordHash,
      nickname: dto.nickname,
    });
    const saved = await this.usersRepo.save(user);
    const tokens = await this.issueTokenPair(saved);
    this.logger.log(`회원가입 완료: ${saved.email}`);

    return {
      user: { id: saved.id, email: saved.email, nickname: saved.nickname },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /** 비밀번호 재설정 — reset-password 인증 완료 후 비밀번호 변경 및 세션 무효화 */
  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase();

    const verification = await this.verificationsRepo.findOne({
      where: {
        email,
        purpose: 'reset-password',
        verified: true,
        code: dto.verificationCode,
      },
      order: { createdAt: 'DESC' },
    });
    if (!verification || verification.expiresAt <= new Date()) {
      throw new BadRequestException('이메일 인증이 완료되지 않았습니다.');
    }

    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('가입되지 않은 이메일입니다.');
    }

    const passwordHash = await this.hashPassword(dto.password);
    await this.usersRepo.update(user.id, {
      passwordHash,
      refreshToken: null,
    });
    await this.verificationsRepo.delete({ email, purpose: 'reset-password' });

    this.logger.log(`비밀번호 재설정 완료: ${email}`);

    return { message: '비밀번호가 변경되었습니다.' };
  }

  /** 로그인 성공 시 토큰 쌍 재발급(기존 refresh 무효화 후 갱신) */
  async login(dto: AuthCredentialsDto) {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    const valid =
      user &&
      (await this.comparePassword(dto.password, user.passwordHash));
    if (!valid) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const tokens = await this.issueTokenPair(user);
    this.logger.log(`로그인 성공: ${user.email}`);

    return {
      user: { id: user.id, email: user.email, nickname: user.nickname },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * refresh JWT 검증 + DB 저장값과 일치 시 새 access token만 발급
   * (만료된 access → 401 → 클라이언트가 이 엔드포인트 호출)
   */
  async refreshTokens(dto: RefreshTokenDto) {
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      this.logger.error('JWT_REFRESH_SECRET 미설정');
      throw new UnauthorizedException('서버 설정 오류로 갱신할 수 없습니다.');
    }

    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(
        dto.refreshToken,
        { secret: refreshSecret },
      );
    } catch {
      throw new UnauthorizedException(
        '유효하지 않거나 만료된 refresh token입니다.',
      );
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException(
        'refresh token이 아닙니다. access token으로는 갱신할 수 없습니다.',
      );
    }

    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user?.refreshToken) {
      throw new UnauthorizedException(
        '세션이 종료되었습니다. 다시 로그인해 주세요.',
      );
    }

    if (user.refreshToken !== dto.refreshToken) {
      throw new UnauthorizedException('저장된 refresh token과 일치하지 않습니다.');
    }

    const accessToken = await this.signAccessToken(user);
    return { accessToken };
  }

  /* ───── private helpers ───── */

  private async issueTokenPair(
    user: UserEntity,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.signRefreshToken(user);
    await this.usersRepo.update(user.id, { refreshToken });
    return { accessToken, refreshToken };
  }

  private async signAccessToken(user: UserEntity): Promise<string> {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }
    const expiresIn =
      this.config.get<string>('JWT_EXPIRES_IN') ?? '1h';
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { secret, expiresIn },
    );
  }

  private async signRefreshToken(user: UserEntity): Promise<string> {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET이 설정되지 않았습니다.');
    }
    const expiresIn =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
    return this.jwtService.signAsync(
      { sub: user.id, type: 'refresh' },
      { secret, expiresIn },
    );
  }

  /** SMTP 설정 시 실제 메일 발송, 미설정 시 콘솔 출력 (개발용) */
  private async sendEmail(
    to: string,
    code: string,
    purpose: VerificationPurpose,
  ): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from =
      this.config.get<string>('SMTP_FROM') ?? 'StarChaser <noreply@starchaser.app>';

    if (!host || !user || !pass) {
      this.logger.warn(
        `[개발 모드] SMTP 미설정 — 인증번호를 콘솔에 출력합니다: ${to} → ${code}`,
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: port || 587,
      secure: port === 465,
      auth: { user, pass },
    });

    const isReset = purpose === 'reset-password';
    const subject = isReset
      ? '[StarChaser] 비밀번호 재설정 인증번호'
      : '[StarChaser] 이메일 인증번호';
    const intro = isReset
      ? '비밀번호 재설정을 위한 인증번호입니다.'
      : '이메일 인증을 위한 인증번호입니다.';

    await transporter.sendMail({
      from,
      to,
      subject,
      text: `${intro}\n\n인증번호: ${code}\n\n이 인증번호는 10분간 유효합니다.`,
      html: `<p>${intro}</p><h2>인증번호: <strong>${code}</strong></h2><p>이 인증번호는 10분간 유효합니다.</p>`,
    });

    this.logger.log(`인증 메일 발송 완료: ${to}`);
  }
}
