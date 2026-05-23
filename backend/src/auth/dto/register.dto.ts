import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Length,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @ApiProperty({ minLength: 6 })
  @IsString({ message: '비밀번호를 입력해 주세요.' })
  @MinLength(6, { message: '비밀번호는 6자 이상이어야 합니다.' })
  password: string;

  @ApiProperty({ example: '별지기', minLength: 2, maxLength: 30 })
  @IsString({ message: '닉네임을 입력해 주세요.' })
  @MinLength(2, { message: '닉네임은 2자 이상이어야 합니다.' })
  @MaxLength(30, { message: '닉네임은 30자 이하여야 합니다.' })
  nickname: string;

  @ApiProperty({ example: '123456', description: '이메일 인증번호 6자리' })
  @IsString({ message: '인증번호를 입력해 주세요.' })
  @Length(6, 6, { message: '인증번호는 6자리여야 합니다.' })
  verificationCode: string;
}
