import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class NotificationTestSendDto {
  @ApiProperty({ required: false, example: 'StarChaser 테스트' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ required: false, example: 'FCM 실발송 검증 알림입니다.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;
}
