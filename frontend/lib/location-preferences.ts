import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_ENABLED_KEY_BASE = 'starChaser:locationEnabled';

export function locationEnabledKey(userId: string): string {
  return `${LOCATION_ENABLED_KEY_BASE}:${userId}`;
}

/** 미설정 시 true — 기존 사용자는 위치 기능 켜진 상태로 유지 */
export async function loadLocationEnabled(userId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(locationEnabledKey(userId));
  if (raw === null) return true;
  return raw === 'true';
}

export async function saveLocationEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    locationEnabledKey(userId),
    enabled ? 'true' : 'false',
  );
}
