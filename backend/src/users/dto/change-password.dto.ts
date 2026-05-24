import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { CurrentPasswordDto } from './current-password.dto';

export class ChangePasswordDto extends CurrentPasswordDto {
  @ApiProperty({ minLength: 6, description: '새 비밀번호' })
  @IsString({ message: '새 비밀번호를 입력해 주세요.' })
  @MinLength(6, { message: '비밀번호는 6자 이상이어야 합니다.' })
  newPassword: string;
}
