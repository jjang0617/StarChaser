import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateObservationDto {
  @ApiPropertyOptional({ description: '명소 ID (없으면 null 저장)' })
  @IsOptional()
  @IsUUID()
  spotId?: string;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  starIndexVal: number;

  @ApiProperty({
    description:
      'A/C 합의 10개 score 키 필수 (cloud_score, pm25_score, … correction_score)',
  })
  @IsObject()
  weatherSnapshot: Record<string, unknown>;

  @ApiProperty({ enum: ['success', 'partial', 'fail'] })
  @IsIn(['success', 'partial', 'fail'])
  result: 'success' | 'partial' | 'fail';

  @ApiPropertyOptional({ description: '일기 제목', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ description: '일기 본문' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;
}
