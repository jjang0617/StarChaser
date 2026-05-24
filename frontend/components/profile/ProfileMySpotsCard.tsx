import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { spacing } from '../../themes/design-tokens';
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
import { GlassCard } from '../ui/GlassCard';
import { ProfileSettingIcon } from './ProfileSettingIcon';

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
    <GlassCard padding={8}>
      {loading ? (
        <ActivityIndicator color={theme.primaryGlow} style={styles.loader} />
      ) : (
        <View style={styles.groups}>
          {sections.map((sec, secIndex) => (
            <View
              key={sec.title}
              style={
                secIndex > 0
                  ? [styles.groupAfter, { borderTopColor: theme.borderSubtle }]
                  : undefined
              }
            >
              <Text style={[styles.groupTitle, { color: theme.foreground }]}>{sec.title}</Text>
              {sec.items.length === 0 ? (
                <Text style={[styles.empty, { color: theme.mutedForeground }]}>{sec.empty}</Text>
              ) : (
                sec.items.map((item, i) => (
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
                            void toggleSpotBookmark(userId, item.spotId).then(() => reload());
                          }
                        : undefined
                    }
                  />
                ))
              )}
            </View>
          ))}
        </View>
      )}
    </GlassCard>
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
        styles.rowWrap,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.borderSubtle,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.88 : 1 }]}
        accessibilityRole="button"
      >
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: theme.primaryGlowMuted, borderColor: theme.primaryGlowBorder },
          ]}
        >
          <ProfileSettingIcon name="map-pin" color={theme.primaryGlow} size={16} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.foreground }]} numberOfLines={2}>
            {label}
          </Text>
          {meta ? (
            <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>{meta}</Text>
          ) : null}
        </View>
        {!onRemove ? (
          <ProfileSettingIcon name="chevron-right" color={theme.mutedForeground} size={18} />
        ) : null}
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityLabel="저장 해제"
          style={styles.removeBtn}
        >
          <Text style={{ color: theme.mutedForeground, fontSize: 18, lineHeight: 20 }}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: spacing.lg },
  groups: { gap: spacing.md },
  groupAfter: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  empty: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  removeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
});
