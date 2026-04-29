import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeactivateNotificationTokenDto {
  @ApiProperty({ example: 'fcm_device_token_value' })
  @IsString()
  @MinLength(10)
  fcmToken: string;
}
