import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateCorrectionSubmissionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  spotId: string;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    description: '현장 체감 가시도(별이 잘 보였는지) 0~100',
  })
  @IsInt()
  @Min(0)
  @Max(100)
  perceivedQuality: number;
}
