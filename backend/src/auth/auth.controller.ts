import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: '회원가입 — access·refresh JWT 발급' })
  @ApiOkResponse({
    description: 'access 1h, refresh 30d — refresh는 users.refresh_token에 저장',
  })
  @ApiConflictResponse({ description: '이메일 중복' })
  register(@Body() dto: AuthCredentialsDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  @ApiOperation({ summary: '로그인 — JWT 쌍 발급' })
  @ApiOkResponse({ description: 'accessToken, refreshToken 반환' })
  @ApiUnauthorizedResponse({ description: '이메일/비밀번호 불일치' })
  login(@Body() dto: AuthCredentialsDto) {
    return this.authService.login(dto);
  }

  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('refresh')
  @ApiOperation({
    summary: 'access token 재발급 — Body에 refreshToken(JSON 문자열)',
  })
  @ApiOkResponse({ description: '새 accessToken만 반환' })
  @ApiUnauthorizedResponse({ description: 'refresh 무효/만료' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }
}
