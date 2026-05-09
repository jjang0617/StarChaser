import { registerRootComponent } from 'expo';
import * as Notifications from 'expo-notifications';

import App from './App';

/** 포그라운드에서도 FCM(배너·소리) 표시 — 미설정 시 앱 켜 둔 상태에선 안 보일 수 있음 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
