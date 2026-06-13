import { registerRootComponent } from 'expo';

import App from './App';
import { isExpoGo } from './lib/is-expo-go';

/** 정적 import 금지 — Expo Go Android 에서 네이티브 초기화 시 ERROR 로그 방지 */
if (!isExpoGo()) {
  void import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  });
}

registerRootComponent(App);
