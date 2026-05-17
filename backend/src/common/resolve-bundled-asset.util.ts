import * as fs from 'fs';
import * as path from 'path';

/**
 * Nest `nest build` → dist/{module}/data
 * `nest start --watch` (rootDir 미지정 시) → dist/src/{module}/data 가 아닌 dist/{module}/data 에 asset 복사
 * 두 레이아웃 모두에서 JSON 번들을 찾는다.
 */
export function resolveBundledAssetPath(
  moduleDirname: string,
  /** sourceRoot 기준 폴더명 (예: cache-hydration, sky) */
  moduleSegment: string,
  fileName: string,
): string | null {
  const candidates = [
    path.join(moduleDirname, 'data', fileName),
    path.join(moduleDirname, '..', '..', moduleSegment, 'data', fileName),
    path.join(process.cwd(), 'dist', moduleSegment, 'data', fileName),
    path.join(process.cwd(), 'src', moduleSegment, 'data', fileName),
  ];

  for (const candidate of candidates) {
    const resolved = path.normalize(candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}
