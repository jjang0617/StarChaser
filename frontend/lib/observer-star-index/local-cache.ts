import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StarIndexResponseDto } from '../types/api';
import { bucketCoords } from './coords';

const KEY_PREFIX = 'starChaser:observerStarIndex:';
const TTL_MS = 45 * 60 * 1000;

type CachedEntry = {
  savedAt: string;
  placeLabel: string | null;
  data: StarIndexResponseDto;
};

export type LocalStarIndexCacheHit = {
  data: StarIndexResponseDto;
  placeLabel: string | null;
  isStale: boolean;
};

function storageKey(lat: number, lng: number): string {
  return `${KEY_PREFIX}${bucketCoords(lat, lng)}`;
}

export async function loadLocalStarIndexCache(
  lat: number,
  lng: number,
): Promise<LocalStarIndexCacheHit | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(lat, lng));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry;
    if (!parsed?.data || !parsed.savedAt) return null;
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (!Number.isFinite(age) || age > TTL_MS) {
      await AsyncStorage.removeItem(storageKey(lat, lng));
      return null;
    }
    return {
      data: parsed.data,
      placeLabel: parsed.placeLabel ?? null,
      isStale: age > 10 * 60 * 1000,
    };
  } catch {
    return null;
  }
}

export async function saveLocalStarIndexCache(
  lat: number,
  lng: number,
  data: StarIndexResponseDto,
  placeLabel: string | null,
): Promise<void> {
  try {
    const entry: CachedEntry = {
      savedAt: new Date().toISOString(),
      placeLabel,
      data,
    };
    await AsyncStorage.setItem(storageKey(lat, lng), JSON.stringify(entry));
  } catch {
    /* 저장 실패는 무시 — 네트워크 응답만 사용 */
  }
}
