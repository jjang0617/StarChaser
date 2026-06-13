import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ApiRequestError,
  fetchStarIndexSpotScores,
  SessionExpiredError,
} from '../../lib/api-client';
import type { ClusterSpotRnDto } from '../../lib/types/map-spot';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';
import {
  bottomSheetStyle,
  glassCardStyle,
  sheetOverlayStyle,
  spacing,
  typography,
} from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

type Props = {
  visible: boolean;
  title: string;
  spots: ClusterSpotRnDto[];
  /** 명소 상세에서 점수 갱신 후 클러스터 목록 재조회 */
  scoreRefreshToken?: number;
  onClose: () => void;
  onPickSpot: (spot: ClusterSpotRnDto) => void;
  onSessionInvalidated?: () => Promise<void>;
};

export function MapClusterSpotsSheet({
  visible,
  title,
  spots,
  scoreRefreshToken = 0,
  onClose,
  onPickSpot,
  onSessionInvalidated,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [scoreById, setScoreById] = useState<Record<string, number>>({});
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresErr, setScoresErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const idsKey = spots.map((s) => s.id).join('|');

  useEffect(() => {
    const ids = idsKey.split('|').filter(Boolean);
    if (!visible || ids.length === 0) {
      setScoreById({});
      setScoresErr(null);
      setScoresLoading(false);
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    setScoresLoading(true);
    setScoresErr(null);
    void (async () => {
      try {
        const rows = await fetchStarIndexSpotScores(ids);
        if (cancelled) return;
        const m: Record<string, number> = {};
        rows.forEach((r) => {
          m[r.spotId] = r.score;
        });
        setScoreById(m);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof SessionExpiredError) {
          await onSessionInvalidated?.();
          return;
        }
        setScoresErr(
          e instanceof ApiRequestError ? e.message : '점수를 불러오지 못했습니다.',
        );
      } finally {
        if (!cancelled) setScoresLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, idsKey, scoreRefreshToken, onSessionInvalidated]);

  const rowShellStyle = (pressed: boolean, isSelected: boolean): ViewStyle => ({
    ...glassCardStyle(theme, {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderLeftWidth: isSelected ? 3 : 1,
      borderLeftColor: isSelected ? theme.primaryGlow : theme.cardBorder,
      backgroundColor: pressed ? theme.inputBackground : theme.card,
    }),
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={sheetOverlayStyle()}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="닫기"
      >
        <Pressable
          style={bottomSheetStyle(theme, Math.max(insets.bottom, 14))}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.grab, { backgroundColor: theme.mutedForeground }]} />
          <View style={styles.sheetHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.sheetTitle, typography.h3, { color: theme.foreground }]}
                numberOfLines={2}
              >
                {title}
              </Text>
              <Text style={[styles.hint, typography.caption, { color: theme.mutedForeground }]}>
                {spots.length}곳의 별 관측 명소
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeIcon,
                { backgroundColor: pressed ? theme.inputBackground : 'transparent' },
              ]}
            >
              <Text style={{ color: theme.mutedForeground, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <Text
            style={[
              styles.hintSecondary,
              typography.caption,
              { color: theme.mutedForeground },
            ]}
          >
            항목을 누르면 지도가 이동하고, 선택한 명소가 별 아이콘으로 강조됩니다.
          </Text>
          {scoresLoading ? (
            <View style={{ paddingVertical: 8, alignItems: 'center' }}>
              <ActivityIndicator color={theme.primaryGlow} />
            </View>
          ) : scoresErr ? (
            <Text
              style={{
                color: theme.destructive,
                fontSize: 12,
                paddingHorizontal: spacing.lg,
                marginBottom: 6,
              }}
            >
              {scoresErr}
            </Text>
          ) : null}
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {spots.map((s) => {
              const main =
                (s.shortTitle && s.shortTitle.trim()) ||
                (s.title && s.title.trim()) ||
                `명소 ${s.id.slice(0, 8)}`;
              const sub =
                s.title && s.shortTitle && s.title.trim() !== s.shortTitle.trim()
                  ? s.title
                  : null;
              const sc = scoreById[s.id];
              const scDisplay = sc != null ? getStarIndexScoreDisplay(sc) : null;
              const isSelected = selectedId === s.id;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`지도로 이동 ${main}`}
                  onPress={() => {
                    setSelectedId(s.id);
                    onPickSpot(s);
                  }}
                  style={({ pressed }) => rowShellStyle(pressed, isSelected)}
                >
                  <View style={styles.rowRow}>
                    <View
                      style={[
                        styles.pinIcon,
                        {
                          backgroundColor: theme.primaryGlowMuted,
                          borderColor: theme.primaryGlowBorder,
                        },
                      ]}
                    >
                      <Feather name="map-pin" size={14} color={theme.primaryGlow} />
                    </View>
                    <View style={styles.rowLeft}>
                      <Text
                        style={[styles.rowMain, { color: theme.foreground }]}
                        numberOfLines={2}
                      >
                        {main}
                      </Text>
                      {sub ? (
                        <Text
                          style={[styles.rowSub, { color: theme.mutedForeground }]}
                          numberOfLines={2}
                        >
                          {sub}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.scoreCol}>
                      <Text
                        style={[
                          styles.scoreText,
                          {
                            color: scDisplay?.measurable
                              ? theme.primaryGlow
                              : theme.destructive,
                            fontSize: 18,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {scoresLoading ? '…' : scDisplay != null ? scDisplay.label : '—'}
                      </Text>
                      <Text style={[styles.scoreLabel, { color: theme.mutedForeground }]}>
                        Star-Index
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeBtn,
              glassCardStyle(theme, {
                marginHorizontal: spacing.lg,
                marginTop: spacing.sm,
                alignItems: 'center',
                backgroundColor: pressed ? theme.inputBackground : theme.card,
              }),
            ]}
          >
            <Text style={{ color: theme.foreground, fontWeight: '600', fontSize: 15 }}>
              닫기
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  grab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
    opacity: 0.35,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sheetTitle: {},
  hint: { marginTop: 4 },
  hintSecondary: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  closeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    maxHeight: 360,
  },
  rowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
  },
  rowMain: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  rowSub: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  scoreCol: {
    alignItems: 'flex-end',
    minWidth: 48,
  },
  scoreText: {
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  scoreLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  closeBtn: {
    paddingVertical: 14,
  },
});
