import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class UpsertNotificationTokenDto {
  @ApiProperty({ example: 'fcm_device_token_value' })
  @IsString()
  @MinLength(10)
  fcmToken: string;

  @ApiProperty({ example: 'android', enum: ['ios', 'android', 'web'] })
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';
}
