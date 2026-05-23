import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { UserEntity } from './user.entity';
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
    private readonly storage: SupabaseStorageService,
  ) {}

  toProfileDto(user: UserEntity): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    };
  }

  async getMe(userId: string): Promise<UserProfileDto> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return this.toProfileDto(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<UserProfileDto> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

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

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const avatarUrl = await this.storage.uploadAvatar(
      userId,
      file.buffer,
      file.mimetype,
    );
    user.avatarUrl = avatarUrl;
    await this.usersRepo.save(user);
    return this.toProfileDto(user);
  }

  async deleteAvatar(userId: string): Promise<UserProfileDto> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    await this.storage.removeAvatar(userId);
    user.avatarUrl = null;
    await this.usersRepo.save(user);
    return this.toProfileDto(user);
  }
}
