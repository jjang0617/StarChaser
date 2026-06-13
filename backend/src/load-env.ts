import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Nest 기동 전 process.env 에 .env 주입.
 * - 이 파일은 dist/load-env.js 로 컴파일되므로 __dirname/../.env = backend/.env
 * - Windows 등에서 비어 있는 동명 환경변수가 이미 있으면 dotenv 기본 동작은 덮어쓰지 않음 → override: true
 */
const fromThisFile = resolve(__dirname, '..', '.env');
const fromMonorepoRoot = resolve(process.cwd(), 'backend', '.env');
const fromCwd = resolve(process.cwd(), '.env');

let loadedPath: string | null = null;
for (const p of [fromThisFile, fromMonorepoRoot, fromCwd]) {
  if (!existsSync(p)) continue;
  const r = config({ path: p, override: true });
  if (r.error) {
    // eslint-disable-next-line no-console
    console.warn(`[load-env] dotenv 파싱 오류 (${p}):`, r.error.message);
    continue;
  }
  loadedPath = p;
  break;
}

if (!loadedPath && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.warn(
    `[load-env] .env 파일 없음. 시도한 경로:\n  ${fromThisFile}\n  ${fromMonorepoRoot}\n  ${fromCwd}`,
  );
}

if (process.env.NODE_ENV !== 'production') {
  const v = process.env.FCM_SCHEDULED_STAR_INDEX_PUSH_ENABLED;
  // eslint-disable-next-line no-console
  console.log(
    `[load-env] FCM_SCHEDULED_STAR_INDEX_PUSH_ENABLED=${JSON.stringify(v)} (파일: ${loadedPath ?? '없음'})`,
  );
}
