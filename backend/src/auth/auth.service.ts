import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../users/user.entity';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

type RefreshPayload = { sub: string; type?: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async comparePassword(password: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(password, hashed);
  }

  /** 회원가입 후 access·refresh JWT 발급 및 refresh_token DB 저장 */
  async register(dto: AuthCredentialsDto) {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = this.usersRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
    });
    const saved = await this.usersRepo.save(user);
    const tokens = await this.issueTokenPair(saved);
    this.logger.log(`회원가입 완료: ${saved.email}`);

    return {
      user: { id: saved.id, email: saved.email },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
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
      user: { id: user.id, email: user.email },
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
}
