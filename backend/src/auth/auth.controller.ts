import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { IsEmail, IsString, MinLength } from 'class-validator';

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 회원가입 — 60초 내 5회 제한 (브루트포스 방지)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: '회원가입 (bcrypt 해싱)' })
  async register(@Body() dto: RegisterDto) {
    const hashedPassword = await this.authService.hashPassword(dto.password);
    // TODO: 2주차 — DB 저장 로직 추가
    return {
      message: '회원가입 성공 (PoC)',
      email: dto.email,
      hashedPassword, // 실제 서비스에서는 절대 반환 금지
    };
  }

  // 로그인 — 60초 내 10회 제한
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  @ApiOperation({ summary: '로그인 (bcrypt 검증)' })
  async login(@Body() dto: RegisterDto) {
    // TODO: 2주차 — DB에서 유저 조회 후 검증
    const testHash = await this.authService.hashPassword(dto.password);
    const isValid = await this.authService.comparePassword(dto.password, testHash);
    return {
      message: isValid ? '로그인 성공 (PoC)' : '로그인 실패',
      isValid,
    };
  }
}