import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateSpotReportDto {
  @ApiProperty({ description: '명소 제보 설명', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  message: string;

  @ApiProperty({ minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
