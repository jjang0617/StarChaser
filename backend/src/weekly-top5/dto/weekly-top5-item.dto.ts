import { ApiProperty } from '@nestjs/swagger';

/** GET /top5/weekly 한 행 — spots 조인으로 채운 노출용 DTO */
export class WeeklyTop5ItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description:
      '집계 구간이 시작된 월요일 (지난주 월~일 TOP5의 week_start, YYYY-MM-DD)',
    example: '2026-05-04',
  })
  weekStart: string;

  @ApiProperty({ description: 'TOP5 카드에 표시할 순위', minimum: 1, maximum: 5 })
  rank: number;

  @ApiProperty({ format: 'uuid' })
  spotId: string;

  @ApiProperty({ description: 'spots.name 조인' })
  spotName: string;

  @ApiProperty({ description: '해당 주 평균 Star-Index (스냅샷)', example: 82.5 })
  avgStarIndex: number;
}
