import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '내 프로필 조회' })
  getMe(@CurrentUser() user: JwtValidatedUser): Promise<UserProfileDto> {
    return this.usersService.getMe(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: '내 프로필 수정 (닉네임)' })
  updateMe(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return this.usersService.updateMe(user.userId, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: '프로필 사진 업로드 (Supabase Storage)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: JwtValidatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserProfileDto> {
    return this.usersService.uploadAvatar(user.userId, file);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: '프로필 사진 삭제 — 기본 아바타(닉네임 첫 글자)로' })
  deleteAvatar(@CurrentUser() user: JwtValidatedUser): Promise<UserProfileDto> {
    return this.usersService.deleteAvatar(user.userId);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('me/password')
  @ApiOperation({ summary: '로그인 상태 비밀번호 변경' })
  changePassword(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.usersService.changePassword(user.userId, dto);
  }

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Delete('me')
  @ApiOperation({ summary: '회원 탈퇴 — 계정 및 연관 데이터 완전 삭제' })
  deleteMe(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: DeleteAccountDto,
  ): Promise<{ message: string }> {
    return this.usersService.deleteAccount(user.userId, dto);
  }
}
