import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { WeatherSnapshot } from '../../common/interfaces/weather-snapshot';

export class ObservationPhotoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  imageUrl: string;
}

export class ObservationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional({ nullable: true })
  spotId: string | null;

  @ApiProperty()
  starIndexVal: number;

  @ApiProperty()
  weatherSnapshot: WeatherSnapshot;

  @ApiProperty({ enum: ['success', 'partial', 'fail'] })
  result: 'success' | 'partial' | 'fail';

  @ApiPropertyOptional({ nullable: true })
  title: string | null;

  @ApiPropertyOptional({ nullable: true })
  content: string | null;

  @ApiProperty()
  observedAt: string;

  @ApiProperty({ type: [ObservationPhotoDto] })
  photos: ObservationPhotoDto[];
}
