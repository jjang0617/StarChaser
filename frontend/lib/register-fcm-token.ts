import { Platform } from 'react-native';

import { authorizedPostJson } from './api-client';
import { isExpoGo } from './is-expo-go';

/**
 * Android FCM 디바이스 토큰만 서버에 등록.
 * 로그인·세션 복구 후 호출. (iOS는 Firebase/APNs 미연동이라 생략 — 무효 토큰 DB 적재 방지)
 *
 * expo-notifications 는 Expo Go 에서 동적 import 만 수행 — 번들 로드 시 네이티브 ERROR 방지.
 */
export async function registerDevicePushTokenWithServer(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (isExpoGo()) return;

  try {
    const Notifications = await import('expo-notifications');
    const { status: existing } = await Notifications.getPermissionsAsync();
    let granted = existing === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;

    const push = await Notifications.getDevicePushTokenAsync();
    const token = push.data?.trim?.() ?? '';
    if (token.length < 10) return;

    await authorizedPostJson('/notifications/token', {
      fcmToken: token,
      platform: 'android',
    });
  } catch (e) {
    if (__DEV__) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[registerDevicePushTokenWithServer]', msg);
    }
  }
}
