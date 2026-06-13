import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_BASE = 'starChaser:spotActivity';
const RECENT_MAX = 20;

export interface SpotActivityStore {
  recent: string[];
  viewCounts: Record<string, number>;
  bookmarks: string[];
}

const EMPTY: SpotActivityStore = { recent: [], viewCounts: {}, bookmarks: [] };

export function spotActivityStorageKey(userId: string): string {
  return `${KEY_BASE}:${userId}`;
}

function parseStore(raw: string | null): SpotActivityStore {
  if (!raw) return { ...EMPTY };
  try {
    const p = JSON.parse(raw) as Partial<SpotActivityStore>;
    const ids = (v: unknown) =>
      Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string') : [];
    return {
      recent: ids(p.recent),
      viewCounts:
        p.viewCounts && typeof p.viewCounts === 'object' ? p.viewCounts : {},
      bookmarks: ids(p.bookmarks),
    };
  } catch {
    return { ...EMPTY };
  }
}

async function read(userId: string): Promise<SpotActivityStore> {
  return parseStore(await AsyncStorage.getItem(spotActivityStorageKey(userId)));
}

async function write(userId: string, store: SpotActivityStore): Promise<void> {
  await AsyncStorage.setItem(spotActivityStorageKey(userId), JSON.stringify(store));
}

async function update(
  userId: string,
  fn: (store: SpotActivityStore) => SpotActivityStore,
): Promise<SpotActivityStore> {
  const next = fn(await read(userId));
  await write(userId, next);
  return next;
}

/** 지도 명소 상세 시트를 열 때만 (클러스터 탭 제외) */
export async function recordSpotDetailView(
  userId: string,
  spotId: string,
): Promise<void> {
  await update(userId, (s) => ({
    ...s,
    recent: [spotId, ...s.recent.filter((id) => id !== spotId)].slice(0, RECENT_MAX),
    viewCounts: { ...s.viewCounts, [spotId]: (s.viewCounts[spotId] ?? 0) + 1 },
  }));
}

export function loadSpotActivity(userId: string): Promise<SpotActivityStore> {
  return read(userId);
}

export function isSpotBookmarked(
  userId: string,
  spotId: string,
): Promise<boolean> {
  return read(userId).then((s) => s.bookmarks.includes(spotId));
}

/** 저장 여부 반환 (true = 저장됨) */
export function toggleSpotBookmark(userId: string, spotId: string): Promise<boolean> {
  let saved = false;
  return update(userId, (s) => {
    const has = s.bookmarks.includes(spotId);
    saved = !has;
    return {
      ...s,
      bookmarks: has
        ? s.bookmarks.filter((id) => id !== spotId)
        : [...s.bookmarks, spotId],
    };
  }).then(() => saved);
}

export async function removeRecentSpot(
  userId: string,
  spotId: string,
): Promise<void> {
  await update(userId, (s) => ({
    ...s,
    recent: s.recent.filter((id) => id !== spotId),
  }));
}

export async function removeSpotViewRecord(
  userId: string,
  spotId: string,
): Promise<void> {
  await update(userId, (s) => {
    if (!(spotId in s.viewCounts)) return s;
    const next = { ...s.viewCounts };
    delete next[spotId];
    return { ...s, viewCounts: next };
  });
}

export async function removeSpotBookmark(
  userId: string,
  spotId: string,
): Promise<void> {
  await update(userId, (s) => ({
    ...s,
    bookmarks: s.bookmarks.filter((id) => id !== spotId),
  }));
}

export function topViewedSpotIds(
  store: SpotActivityStore,
  limit: number,
): Array<{ spotId: string; count: number }> {
  const recentRank = new Map(store.recent.map((id, i) => [id, i]));
  return Object.entries(store.viewCounts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (
        (recentRank.get(a[0]) ?? RECENT_MAX) - (recentRank.get(b[0]) ?? RECENT_MAX)
      );
    })
    .slice(0, limit)
    .map(([spotId, count]) => ({ spotId, count }));
}

/** viewCounts 전체 (조회수 내림차순) */
export function allViewedSpotIds(
  store: SpotActivityStore,
): Array<{ spotId: string; count: number }> {
  const n = Object.keys(store.viewCounts).length;
  return topViewedSpotIds(store, Math.max(n, 1));
}
