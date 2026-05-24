import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../contexts/auth-context';
import { spotNameWithoutRegionPrefix } from '../../lib/spot-display-name';
import {
  loadSpotActivity,
  toggleSpotBookmark,
  topViewedSpotIds,
  type SpotActivityStore,
} from '../../lib/spot-activity-storage';
import { fetchSpotsAll } from '../../lib/spots-api';
import type { SpotDto } from '../../lib/types/api';
import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';
import { Card } from '../ui';

const RECENT_SHOW = 5;
const TOP_SHOW = 3;

export function ProfileMySpotsCard({
  activityRevision,
  onOpenSpotDetail,
}: {
  activityRevision: number;
  onOpenSpotDetail: (spotId: string) => void;
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const userId = user?.id;
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<SpotActivityStore | null>(null);
  const [spotsById, setSpotsById] = useState<Map<string, SpotDto>>(new Map());

  const reload = useCallback(async () => {
    if (!userId) {
      setActivity(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [store, spots] = await Promise.all([
        loadSpotActivity(userId),
        fetchSpotsAll(),
      ]);
      setActivity(store);
      setSpotsById(new Map(spots.map((s) => [s.id, s])));
    } catch {
      setActivity({ recent: [], viewCounts: {}, bookmarks: [] });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload, activityRevision]);

  const label = useCallback(
    (spotId: string) => {
      const name = spotsById.get(spotId)?.name;
      return name ? spotNameWithoutRegionPrefix(name) : `명소 ${spotId.slice(0, 8)}…`;
    },
    [spotsById],
  );

  const sections = useMemo((): Array<{
    title: string;
    empty: string;
    items: Array<{ spotId: string; meta?: string; removable?: boolean }>;
  }> => {
    if (!activity) return [];
    return [
      {
        title: '최근 본 명소',
        empty: '아직 없습니다. 지도에서 명소를 눌러 상세를 확인해 보세요.',
        items: activity.recent.slice(0, RECENT_SHOW).map((spotId) => ({ spotId })),
      },
      {
        title: '자주 본 명소',
        empty: '상세를 여러 번 본 명소가 여기 표시됩니다.',
        items: topViewedSpotIds(activity, TOP_SHOW).map(({ spotId, count }) => ({
          spotId,
          meta: `${count}회`,
        })),
      },
      {
        title: '저장한 명소',
        empty: '명소 상세에서 저장(☆)을 눌러 추가할 수 있습니다.',
        items: activity.bookmarks.map((spotId) => ({ spotId, removable: true })),
      },
    ];
  }, [activity]);

  if (!userId) return null;

  return (
    <Card>
      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>내 명소</Text>
      <Text style={[styles.sectionDesc, { color: theme.mutedForeground }]}>
        지도에서 명소 상세를 열면 최근·자주 본 목록에 반영됩니다.
      </Text>

      {loading ? (
        <ActivityIndicator color={theme.starGold} style={{ marginVertical: 16 }} />
      ) : (
        <View style={{ gap: 16 }}>
          {sections.map((sec) => (
            <View key={sec.title} style={{ gap: 8 }}>
              <Text style={[styles.subTitle, { color: theme.foreground }]}>{sec.title}</Text>
              {sec.items.length === 0 ? (
                <Text style={[styles.empty, { color: theme.mutedForeground }]}>{sec.empty}</Text>
              ) : (
                <View style={[styles.list, { borderColor: theme.border }]}>
                  {sec.items.map((item, i) => (
                    <SpotRow
                      key={`${sec.title}-${item.spotId}`}
                      theme={theme}
                      label={label(item.spotId)}
                      meta={item.meta}
                      isLast={i === sec.items.length - 1}
                      onPress={() => onOpenSpotDetail(item.spotId)}
                      onRemove={
                        item.removable
                          ? () => {
                              void toggleSpotBookmark(userId, item.spotId).then(() =>
                                reload(),
                              );
                            }
                          : undefined
                      }
                    />
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function SpotRow({
  theme,
  label,
  meta,
  isLast,
  onPress,
  onRemove,
}: {
  theme: ThemeTokens;
  label: string;
  meta?: string;
  isLast?: boolean;
  onPress: () => void;
  onRemove?: () => void;
}) {
  return (
    <View
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.rowPress, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.rowLabel, { color: theme.foreground }]} numberOfLines={2}>
          {label}
        </Text>
        {meta ? (
          <Text style={[styles.rowMeta, { color: theme.mutedForeground }]}>{meta}</Text>
        ) : null}
      </Pressable>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="저장 해제">
          <Text style={{ color: theme.mutedForeground, fontSize: 18 }}>×</Text>
        </Pressable>
      ) : (
        <Text style={[styles.chevron, { color: theme.mutedForeground }]}>›</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sectionDesc: { fontSize: 12, lineHeight: 17, marginBottom: 14 },
  subTitle: { fontSize: 14, fontWeight: '600' },
  empty: { fontSize: 12, lineHeight: 17 },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  rowMeta: { fontSize: 12 },
  chevron: { fontSize: 18, paddingHorizontal: 10 },
});
