import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Expo Go(스토어 클라이언트) — SDK 53+ 에서 원격 푸시 제한 등 동작이 다름 */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}
