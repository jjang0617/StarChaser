import { Platform, type PressableProps } from 'react-native';

/** Android Material 리플(검은 둥근 사각형) 완전 비활성화 */
export const androidPressableProps: Pick<PressableProps, 'android_ripple'> =
  Platform.OS === 'android' ? { android_ripple: null } : {};
