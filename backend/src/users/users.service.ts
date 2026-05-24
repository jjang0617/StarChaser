import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { EmailVerificationEntity } from '../auth/email-verification.entity';
import { UserEntity } from './user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const ALLOWED_AVATAR_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(EmailVerificationEntity)
    private readonly verificationsRepo: Repository<EmailVerificationEntity>,
    private readonly storage: SupabaseStorageService,
    private readonly authService: AuthService,
  ) {}

  toProfileDto(user: UserEntity): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    };
  }

  private async findUserOrThrow(userId: string): Promise<UserEntity> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return user;
  }

  private async assertCurrentPassword(
    user: UserEntity,
    currentPassword: string,
  ): Promise<void> {
    const valid = await this.authService.comparePassword(
      currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      throw new BadRequestException('현재 비밀번호가 올바르지 않습니다.');
    }
  }

  async getMe(userId: string): Promise<UserProfileDto> {
    const user = await this.findUserOrThrow(userId);
    return this.toProfileDto(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<UserProfileDto> {
    const user = await this.findUserOrThrow(userId);

    if (dto.nickname !== undefined) {
      const trimmed = dto.nickname.trim();
      const taken = await this.usersRepo.findOne({
        where: { nickname: trimmed },
      });
      if (taken && taken.id !== userId) {
        throw new ConflictException('이미 사용 중인 닉네임입니다.');
      }
      user.nickname = trimmed;
    }

    await this.usersRepo.save(user);
    return this.toProfileDto(user);
  }

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UserProfileDto> {
    if (!file?.buffer?.length) {
      throw new ConflictException('이미지 파일이 없습니다.');
    }
    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      throw new ConflictException('JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.');
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new ConflictException('이미지는 5MB 이하여야 합니다.');
    }

    const user = await this.findUserOrThrow(userId);

    const avatarUrl = await this.storage.uploadAvatar(
      userId,
      file.buffer,
      file.mimetype,
    );
    user.avatarUrl = avatarUrl;
    await this.usersRepo.save(user);
    return this.toProfileDto(user);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.findUserOrThrow(userId);
    await this.assertCurrentPassword(user, dto.currentPassword);

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        '새 비밀번호는 현재 비밀번호와 달라야 합니다.',
      );
    }

    const passwordHash = await this.authService.hashPassword(dto.newPassword);
    await this.usersRepo.update(userId, { passwordHash });

    return { message: '비밀번호가 변경되었습니다.' };
  }

  async deleteAvatar(userId: string): Promise<UserProfileDto> {
    const user = await this.findUserOrThrow(userId);

    await this.storage.removeAvatar(userId);
    user.avatarUrl = null;
    await this.usersRepo.save(user);
    return this.toProfileDto(user);
  }

  /** 회원 탈퇴 — 완전 삭제 (연관 데이터 DB CASCADE, 아바타·인증 메일 정리) */
  async deleteAccount(
    userId: string,
    dto: DeleteAccountDto,
  ): Promise<{ message: string }> {
    const user = await this.findUserOrThrow(userId);
    await this.assertCurrentPassword(user, dto.currentPassword);

    await this.storage.removeAvatar(userId);
    await this.verificationsRepo.delete({ email: user.email });
    await this.usersRepo.delete({ id: userId });

    return { message: '회원 탈퇴가 완료되었습니다.' };
  }
}
