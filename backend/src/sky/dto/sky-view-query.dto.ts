import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** GET /sky/view — 관측자 위치·시각(UT) 기준 천구 MVP */
export class SkyViewQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({
    description: '관측 시각(UTC) ISO8601 — 생략 시 서버 수신 시각',
    example: '2026-05-01T15:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  at?: string;
}
