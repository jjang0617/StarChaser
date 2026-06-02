import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { STAR_INDEX_ALERT_THRESHOLDS } from '../star-index-alert-threshold';

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  alertsEnabled?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  starIndexAlertEnabled?: boolean;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  locationStarIndexAlertEnabled?: boolean;

  @ApiPropertyOptional({ example: 90, enum: [80, 85, 90, 95] })
  @IsOptional()
  @IsInt()
  @IsIn(STAR_INDEX_ALERT_THRESHOLDS as unknown as number[])
  starIndexAlertThreshold?: number;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  top3AlertEnabled?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Star-Index 임계 알림 기준 명소 UUID. null 이면 기준 명소 해제.',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID('4')
  alertSpotId?: string | null;
}
