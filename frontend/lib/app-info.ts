import Constants from 'expo-constants';

import { isExpoGo } from './is-expo-go';

const APP_DISPLAY_NAME = 'StarChaser';

export function getAppDisplayName(): string {
  const fromConfig = Constants.expoConfig?.name?.trim();
  if (fromConfig && fromConfig !== 'frontend') {
    return fromConfig;
  }
  return APP_DISPLAY_NAME;
}

/** 스토어·사용자에게 보여 줄 버전 — app.json `expo.version` (예: 1.0.0) */
export function getMarketingVersion(): string {
  return Constants.expoConfig?.version ?? '—';
}

/** 마이페이지 메인 버전 문자열 */
export function getAppVersionLabel(): string {
  return getMarketingVersion();
}

/** 빌드 번호·실행 환경 (보조 문구, 없으면 null) */
export function getAppVersionSubLabel(): string | null {
  if (isExpoGo()) {
    return 'Expo Go에서 실행 중';
  }
  const build = Constants.nativeBuildVersion;
  if (build) {
    return `빌드 ${build}`;
  }
  return null;
}
