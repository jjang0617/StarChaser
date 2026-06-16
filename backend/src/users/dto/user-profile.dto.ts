import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  nickname: string | null;

  @ApiProperty({ nullable: true, description: '없으면 앱에서 닉네임 첫 글자 아바타' })
  avatarUrl: string | null;

  @ApiProperty({ nullable: true, description: '카카오 로그인 연동 ID' })
  kakaoId: string | null;
}
