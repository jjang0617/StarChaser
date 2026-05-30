import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { ObservationMismatchType } from '../observation-mismatch-report.entity';

export class CreateObservationMismatchReportDto {
  @ApiProperty()
  @IsUUID()
  observationId: string;

  @ApiProperty({ enum: ['unmeasurable_but_success', 'high_score_but_fail'] })
  @IsIn(['unmeasurable_but_success', 'high_score_but_fail'])
  mismatchType: ObservationMismatchType;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
