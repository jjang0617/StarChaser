import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const AVATAR_BUCKET = 'avatars';
/** 업로드 시 사용하는 확장자와 동일 (jpeg → jpg) */
const AVATAR_OBJECT_PATHS = ['jpg', 'png', 'webp'] as const;

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly client: SupabaseClient | null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.client =
      url && serviceKey ? createClient(url, serviceKey) : null;
    if (!this.client) {
      this.logger.warn(
        'SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 미설정 — 프로필 사진 업로드 불가',
      );
    }
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        '프로필 사진 저장소가 설정되지 않았습니다.',
      );
    }
    return this.client;
  }

  private extensionFromMime(mime: string): 'jpg' | 'png' | 'webp' {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }

  private objectPath(userId: string, ext: string): string {
    return `${userId}/avatar.${ext}`;
  }

  /** 공개 버킷 기준 URL — 업로드 후 DB에 저장 */
  getPublicUrl(path: string): string {
    const client = this.requireClient();
    const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async uploadAvatar(
    userId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const client = this.requireClient();
    const ext = this.extensionFromMime(mimeType);
    const path = this.objectPath(userId, ext);

    await this.removeAvatarFiles(userId);

    const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) {
      this.logger.error(`아바타 업로드 실패: ${error.message}`);
      throw new ServiceUnavailableException('프로필 사진 업로드에 실패했습니다.');
    }

    const baseUrl = this.getPublicUrl(path);
    return `${baseUrl}?v=${Date.now()}`;
  }

  async removeAvatar(userId: string): Promise<void> {
    if (!this.client) return;
    await this.removeAvatarFiles(userId);
  }

  private async removeAvatarFiles(userId: string): Promise<void> {
    const client = this.requireClient();
    const paths = AVATAR_OBJECT_PATHS.map((ext) => this.objectPath(userId, ext));
    const { error } = await client.storage.from(AVATAR_BUCKET).remove(paths);
    if (error) {
      this.logger.warn(`아바타 삭제 경고: ${error.message}`);
    }
  }
}
