import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class KakaoLoginDto {
  @ApiProperty({ description: '카카오 인가 코드', example: 'authorization_code_xxx' })
  @IsNotEmpty({ message: '인가 코드는 필수입니다.' })
  @IsString({ message: '인가 코드는 문자열이어야 합니다.' })
  code: string;

  @ApiProperty({ description: '인가 코드를 받을 때 사용한 redirectUri', example: 'http://localhost:3333/auth/kakao/callback' })
  @IsNotEmpty({ message: '리다이렉트 URI는 필수입니다.' })
  @IsString({ message: '리다이렉트 URI는 문자열이어야 합니다.' })
  redirectUri: string;
}
