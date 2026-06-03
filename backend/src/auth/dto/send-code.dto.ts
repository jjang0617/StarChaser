import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString } from 'class-validator';

export class SendCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @ApiProperty({
    example: 'register',
    enum: ['register', 'reset-password'],
  })
  @IsString({ message: 'purpose를 입력해 주세요.' })
  @IsIn(['register', 'reset-password'], { message: '요청 유형이 올바르지 않습니다.' })
  purpose: 'register' | 'reset-password';
}
