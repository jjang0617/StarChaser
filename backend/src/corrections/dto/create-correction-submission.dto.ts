import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateCorrectionSubmissionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  spotId: string;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: '현장에서 느낀 Star-Index 점수 0~100',
  })
  @IsInt()
  @Min(0)
  @Max(100)
  perceivedQuality: number;
}
