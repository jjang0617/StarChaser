import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { spacing, glassCardStyle } from '../../themes/design-tokens';
import { useAuth } from '../../contexts/auth-context';
import { spotNameWithoutRegionPrefix } from '../../lib/spot-display-name';
import {
  allViewedSpotIds,
  loadSpotActivity,
  removeRecentSpot,
  removeSpotBookmark,
  removeSpotViewRecord,
  type SpotActivityStore,
} from '../../lib/spot-activity-storage';
import { fetchSpotsAll } from '../../lib/spots-api';
import type { SpotDto } from '../../lib/types/api';
import { useTheme } from '../../themes/ThemeContext';
import { GlassCard } from '../ui/GlassCard';
import { ProfileSettingIcon } from './ProfileSettingIcon';

type MySpotsSectionKey = 'recent' | 'frequent' | 'bookmarks';

const SECTION_META: Record<
  MySpotsSectionKey,
  { title: string; empty: string; icon: 'clock' | 'trending-up' | 'star' }
> = {
  recent: {
    title: '최근 본 명소',
    empty: '아직 없습니다. 지도에서 명소를 눌러 상세를 확인해 보세요.',
    icon: 'clock',
  },
  frequent: {
    title: '자주 본 명소',
    empty: '상세를 여러 번 본 명소가 여기 표시됩니다.',
    icon: 'trending-up',
  },
  bookmarks: {
    title: '저장한 명소',
    empty: '명소 상세에서 저장(☆)을 눌러 추가할 수 있습니다.',
    icon: 'star',
  },
};

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
  const [openSection, setOpenSection] = useState<MySpotsSectionKey | null>(null);

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

  const counts = useMemo(() => {
    if (!activity) {
      return { recent: 0, frequent: 0, bookmarks: 0 };
    }
    return {
      recent: activity.recent.length,
      frequent: allViewedSpotIds(activity).length,
      bookmarks: activity.bookmarks.length,
    };
  }, [activity]);

  const modalItems = useMemo((): Array<{ spotId: string; meta?: string }> => {
    if (!activity || !openSection) return [];
    if (openSection === 'recent') {
      return activity.recent.map((spotId) => ({ spotId }));
    }
    if (openSection === 'frequent') {
      return allViewedSpotIds(activity).map(({ spotId, count }) => ({
        spotId,
        meta: `${count}회`,
      }));
    }
    return activity.bookmarks.map((spotId) => ({ spotId }));
  }, [activity, openSection]);

  const removeItem = useCallback(
    async (spotId: string) => {
      if (!userId || !openSection) return;
      if (openSection === 'recent') {
        await removeRecentSpot(userId, spotId);
      } else if (openSection === 'frequent') {
        await removeSpotViewRecord(userId, spotId);
      } else {
        await removeSpotBookmark(userId, spotId);
      }
      await reload();
    },
    [openSection, reload, userId],
  );

  if (!userId) return null;

  return (
    <>
      <GlassCard padding={8}>
        {loading ? (
          <ActivityIndicator color={theme.primaryGlow} style={styles.loader} />
        ) : (
          <View>
            {(['recent', 'frequent', 'bookmarks'] as const).map((key, index) => (
              <Pressable
                key={key}
                onPress={() => setOpenSection(key)}
                style={({ pressed }) => [
                  styles.summaryRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.borderSubtle,
                  },
                  { opacity: pressed ? 0.88 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${SECTION_META[key].title} ${counts[key]}개`}
              >
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: theme.primaryGlowMuted,
                      borderColor: theme.primaryGlowBorder,
                    },
                  ]}
                >
                  <ProfileSettingIcon
                    name={SECTION_META[key].icon}
                    color={theme.primaryGlow}
                    size={16}
                  />
                </View>
                <Text style={[styles.summaryTitle, { color: theme.foreground }]}>
                  {SECTION_META[key].title}
                </Text>
                <Text
                  style={[
                    styles.summaryCount,
                    { color: theme.primaryGlow, fontFamily: 'SpaceMono-Regular' },
                  ]}
                >
                  {counts[key]}
                </Text>
                <ProfileSettingIcon
                  name="chevron-right"
                  color={theme.mutedForeground}
                  size={18}
                />
              </Pressable>
            ))}
          </View>
        )}
      </GlassCard>

      <Modal
        visible={openSection != null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenSection(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenSection(null)}>
          <Pressable
            style={[styles.modalSheet, glassCardStyle(theme)]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>
              {openSection ? SECTION_META[openSection].title : ''}
            </Text>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {modalItems.length === 0 ? (
                <Text style={[styles.modalEmpty, { color: theme.mutedForeground }]}>
                  {openSection ? SECTION_META[openSection].empty : ''}
                </Text>
              ) : (
                modalItems.map((item, index) => (
                  <View
                    key={`${openSection}-${item.spotId}`}
                    style={[
                      styles.modalRowWrap,
                      index < modalItems.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.borderSubtle,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        setOpenSection(null);
                        onOpenSpotDetail(item.spotId);
                      }}
                      style={({ pressed }) => [
                        styles.modalRow,
                        { opacity: pressed ? 0.88 : 1 },
                      ]}
                      accessibilityRole="button"
                    >
                      <View
                        style={[
                          styles.iconCircle,
                          {
                            backgroundColor: theme.primaryGlowMuted,
                            borderColor: theme.primaryGlowBorder,
                          },
                        ]}
                      >
                        <ProfileSettingIcon name="map-pin" color={theme.primaryGlow} size={16} />
                      </View>
                      <View style={styles.modalRowText}>
                        <Text
                          style={[styles.modalRowTitle, { color: theme.foreground }]}
                          numberOfLines={2}
                        >
                          {label(item.spotId)}
                        </Text>
                        {item.meta ? (
                          <Text style={[styles.modalRowSub, { color: theme.mutedForeground }]}>
                            {item.meta}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => void removeItem(item.spotId)}
                      hitSlop={8}
                      accessibilityLabel="목록에서 제거"
                      style={styles.removeBtn}
                    >
                      <Text style={[styles.removeIcon, { color: theme.mutedForeground }]}>×</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: spacing.lg },
  summaryRow: {
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
  summaryTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCount: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'right',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalSheet: {
    maxHeight: '78%',
    padding: spacing.lg,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalScroll: { maxHeight: 420 },
  modalEmpty: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  modalRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xs,
  },
  modalRowText: { flex: 1, minWidth: 0, gap: 2 },
  modalRowTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  modalRowSub: { fontSize: 12, lineHeight: 16 },
  removeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  removeIcon: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '300',
  },
});
