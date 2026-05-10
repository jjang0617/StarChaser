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
import { useTheme } from '../../themes/ThemeContext';

type Props = {
  visible: boolean;
  title: string;
  spots: ClusterSpotRnDto[];
  onClose: () => void;
  /** 행 탭 — 해당 좌표로 지도 이동 + 라벨 표시 */
  onPickSpot: (spot: ClusterSpotRnDto) => void;
  onSessionInvalidated?: () => Promise<void>;
};

export function MapClusterSpotsSheet({
  visible,
  title,
  spots,
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
  }, [visible, idsKey, onSessionInvalidated]);

  const rowShellStyle = (pressed: boolean, isSelected: boolean): ViewStyle => ({
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.borderSubtle,
    backgroundColor: pressed ? theme.input : theme.card,
    borderLeftWidth: isSelected ? 4 : 0,
    borderLeftColor: isSelected ? theme.starGold : 'transparent',
    paddingLeft: isSelected ? 10 : 14,
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기">
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.grab, { backgroundColor: theme.borderSubtle }]} />
          <Text style={[styles.sheetTitle, { color: theme.foreground }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.hint, { color: theme.mutedForeground }]}>
            항목을 누르면 지도가 이동하고, 선택한 이름이 지도 위에 함께 표시됩니다.
          </Text>
          {scoresLoading ? (
            <View style={{ paddingVertical: 8, alignItems: 'center' }}>
              <ActivityIndicator color={theme.starGold} />
            </View>
          ) : scoresErr ? (
            <Text style={{ color: theme.destructive, fontSize: 12, paddingHorizontal: 16, marginBottom: 6 }}>
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
                s.title && s.shortTitle && s.title.trim() !== s.shortTitle.trim() ? s.title : null;
              const sc = scoreById[s.id];
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
                    <View style={styles.rowLeft}>
                      <Text style={[styles.rowMain, { color: theme.foreground }]} numberOfLines={2}>
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
                    <Text
                      style={[styles.scoreText, { color: theme.starGold }]}
                      numberOfLines={1}
                    >
                      {scoresLoading ? '…' : sc != null ? `${sc}` : '—'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeBtn,
              {
                borderColor: theme.border,
                backgroundColor: pressed ? theme.input : theme.background,
              },
            ]}
          >
            <Text style={{ color: theme.foreground, fontWeight: '600' }}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    maxHeight: '62%',
    paddingTop: 8,
  },
  grab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 16,
    marginBottom: 8,
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
  rowLeft: {
    flex: 1,
    minWidth: 0,
  },
  rowMain: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  rowSub: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  scoreText: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'right',
  },
  closeBtn: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
});
