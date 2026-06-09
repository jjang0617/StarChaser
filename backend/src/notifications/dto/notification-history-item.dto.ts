import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'star_index_threshold' })
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiPropertyOptional()
  data?: Record<string, string> | null;

  @ApiPropertyOptional({ nullable: true })
  readAt: string | null;

  @ApiProperty()
  createdAt: string;
}

export class NotificationHistoryResponseDto {
  @ApiProperty({ type: [NotificationHistoryItemDto] })
  items: NotificationHistoryItemDto[];

  @ApiProperty()
  unreadCount: number;

  @ApiProperty({ description: 'before 커서로 다음 페이지 요청 가능 여부' })
  hasMore: boolean;
}
