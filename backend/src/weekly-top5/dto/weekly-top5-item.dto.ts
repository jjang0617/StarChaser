import { ApiProperty } from '@nestjs/swagger';

export class WeeklyTop5ItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: '집계 주 월요일', example: '2026-05-04' })
  weekStart: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rank: number;

  @ApiProperty({ format: 'uuid' })
  spotId: string;

  @ApiProperty()
  spotName: string;

  @ApiProperty({ example: 82.5 })
  avgStarIndex: number;
}
