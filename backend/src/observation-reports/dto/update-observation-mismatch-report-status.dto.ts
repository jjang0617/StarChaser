import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { ObservationMismatchReportStatus } from '../observation-mismatch-report.entity';

export class UpdateObservationMismatchReportStatusDto {
  @ApiProperty({ enum: ['pending', 'reviewed'] })
  @IsIn(['pending', 'reviewed'])
  status: ObservationMismatchReportStatus;
}
