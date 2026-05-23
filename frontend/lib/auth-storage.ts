import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_ACCESS = 'starChaser:accessToken';
const KEY_REFRESH = 'starChaser:refreshToken';
const KEY_USER = 'starChaser:userJson';

export interface StoredUser {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string | null;
}

export async function saveSession(params: {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
}): Promise<void> {
  await AsyncStorage.multiSet([
    [KEY_ACCESS, params.accessToken],
    [KEY_REFRESH, params.refreshToken],
    [KEY_USER, JSON.stringify(params.user)],
  ]);
}

export async function setAccessToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEY_ACCESS, token);
}

export async function loadTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [[, access], [, refresh]] = await AsyncStorage.multiGet([
    KEY_ACCESS,
    KEY_REFRESH,
  ]);
  return { accessToken: access, refreshToken: refresh };
}

export async function loadUser(): Promise<StoredUser | null> {
  const raw = await AsyncStorage.getItem(KEY_USER);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as StoredUser;
    if (u && typeof u.id === 'string' && typeof u.email === 'string') {
      return {
        id: u.id,
        email: u.email,
        nickname: typeof u.nickname === 'string' ? u.nickname : '',
        avatarUrl:
          u.avatarUrl === null || typeof u.avatarUrl === 'string'
            ? u.avatarUrl
            : null,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_ACCESS, KEY_REFRESH, KEY_USER]);
}

/** 온보딩·알림 로컬 캐시 — 사용자별 키 (App.tsx / OnboardingFlow와 동일 규칙) */
export const ONBOARDING_COMPLETED_KEY_BASE = 'starChaser:onboardingCompleted';
export const NOTIFICATION_PREFS_KEY_BASE = 'starChaser:notificationPrefs';

export function onboardingCompletedKey(userId: string): string {
  return `${ONBOARDING_COMPLETED_KEY_BASE}:${userId}`;
}

export function notificationPrefsKey(userId: string): string {
  return `${NOTIFICATION_PREFS_KEY_BASE}:${userId}`;
}

export function userScopedStorageKeys(userId: string): string[] {
  return [onboardingCompletedKey(userId), notificationPrefsKey(userId)];
}

export async function clearUserScopedStorage(userId: string): Promise<void> {
  await AsyncStorage.multiRemove(userScopedStorageKeys(userId));
}

export async function patchStoredUser(patch: Partial<StoredUser>): Promise<void> {
  const current = await loadUser();
  if (!current) return;
  await AsyncStorage.setItem(
    KEY_USER,
    JSON.stringify({ ...current, ...patch }),
  );
}
