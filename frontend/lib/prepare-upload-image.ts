import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const HEIC_MIMES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const ALLOWED_UPLOAD_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const HEIC_EXT = /\.(heic|heif)$/i;

export const UPLOAD_IMAGE_FORMAT_ERROR =
  '이 사진 형식은 업로드에 실패했습니다. 다른 사진을 선택하거나 다시 시도해주세요.';

export interface PreparedUploadImage {
  uri: string;
  mimeType: string;
}

function normalizeMimeType(mimeType?: string | null): string {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime === 'image/png') return 'image/png';
  if (mime === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function looksLikeHeic(
  mimeType?: string | null,
  uri?: string,
  fileName?: string | null,
): boolean {
  const mime = (mimeType ?? '').toLowerCase();
  if (HEIC_MIMES.has(mime) || mime.includes('heic') || mime.includes('heif')) {
    return true;
  }
  const path = (uri ?? '').split('?')[0];
  if (HEIC_EXT.test(path)) return true;
  if (fileName && HEIC_EXT.test(fileName)) return true;
  return false;
}

/** 서버 허용 형식이 아니거나 HEIC/HEIF면 JPEG 변환 */
export function needsUploadImageConversion(
  mimeType?: string | null,
  uri?: string,
  fileName?: string | null,
): boolean {
  if (looksLikeHeic(mimeType, uri, fileName)) return true;
  const mime = (mimeType ?? '').toLowerCase();
  if (!mime) return true;
  return !ALLOWED_UPLOAD_MIMES.has(mime);
}

/**
 * 업로드 전 이미지 정규화.
 * HEIC/HEIF·미지원 MIME은 JPEG로 변환하고, PNG/WebP·JPEG는 그대로 둔다.
 */
export async function prepareImageForUpload(
  uri: string,
  mimeType?: string | null,
  fileName?: string | null,
): Promise<PreparedUploadImage> {
  if (!uri?.trim()) {
    throw new Error('IMAGE_CONVERT_FAILED');
  }

  if (!needsUploadImageConversion(mimeType, uri, fileName)) {
    return {
      uri,
      mimeType: normalizeMimeType(mimeType),
    };
  }

  const context = ImageManipulator.manipulate(uri);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.85,
    format: SaveFormat.JPEG,
  });

  if (!saved.uri) {
    throw new Error('IMAGE_CONVERT_FAILED');
  }

  return {
    uri: saved.uri,
    mimeType: 'image/jpeg',
  };
}
