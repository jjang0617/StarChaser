import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_ACCESS = 'starChaser:accessToken';
const KEY_REFRESH = 'starChaser:refreshToken';
const KEY_USER = 'starChaser:userJson';

export interface StoredUser {
  id: string;
  email: string;
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
    if (u && typeof u.id === 'string' && typeof u.email === 'string') return u;
  } catch {
    /* ignore */
  }
  return null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_ACCESS, KEY_REFRESH, KEY_USER]);
}
