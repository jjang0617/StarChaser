import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @ApiProperty({ example: '123456', description: '인증번호 6자리' })
  @IsString({ message: '인증번호를 입력해 주세요.' })
  @Length(6, 6, { message: '인증번호는 6자리여야 합니다.' })
  code: string;
}
