import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { RegisterDto } from './dto/register.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { CheckEmailDto } from './dto/check-email.dto';
import { CheckNicknameDto } from './dto/check-nickname.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('check-email')
  @ApiOperation({ summary: '이메일 중복 확인' })
  @ApiOkResponse({ description: '{ available: boolean }' })
  checkEmail(@Body() dto: CheckEmailDto) {
    return this.authService.checkEmail(dto.email);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('check-nickname')
  @ApiOperation({ summary: '닉네임 중복 확인' })
  @ApiOkResponse({ description: '{ available: boolean }' })
  checkNickname(@Body() dto: CheckNicknameDto) {
    return this.authService.checkNickname(dto.nickname);
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('send-code')
  @ApiOperation({ summary: '이메일 인증번호 발송' })
  @ApiOkResponse({ description: '인증번호 발송 완료 메시지' })
  sendCode(@Body() dto: SendCodeDto) {
    return this.authService.sendCode(dto);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('verify-code')
  @ApiOperation({ summary: '이메일 인증번호 확인' })
  @ApiOkResponse({ description: '{ verified: boolean }' })
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  @ApiOperation({ summary: '비밀번호 재설정 — reset-password 인증 완료 후 변경' })
  @ApiOkResponse({ description: '비밀번호 변경 완료 메시지' })
  @ApiBadRequestResponse({ description: '이메일 인증 미완료' })
  @ApiNotFoundResponse({ description: '가입되지 않은 이메일' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: '회원가입 — 이메일 인증 완료 후 access·refresh JWT 발급' })
  @ApiOkResponse({
    description: 'access 1h, refresh 30d — refresh는 users.refresh_token에 저장',
  })
  @ApiConflictResponse({ description: '이메일 또는 닉네임 중복' })
  @ApiBadRequestResponse({ description: '이메일 인증 미완료' })
  register(@Body() dto: RegisterDto) {
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
