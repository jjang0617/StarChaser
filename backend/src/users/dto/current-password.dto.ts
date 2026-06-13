import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CurrentPasswordDto {
  @ApiProperty({ description: '현재 비밀번호' })
  @IsString({ message: '비밀번호를 입력해 주세요.' })
  currentPassword: string;
}
