import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CheckNicknameDto {
  @ApiProperty({ example: '별지기', minLength: 2, maxLength: 30 })
  @IsString({ message: '닉네임을 입력해 주세요.' })
  @MinLength(2, { message: '닉네임은 2자 이상이어야 합니다.' })
  @MaxLength(30, { message: '닉네임은 30자 이하여야 합니다.' })
  nickname: string;
}
