/**
 * Figma SkyScreen — Star-Index FAB + 하단 시트 (뷰어/렌더 로직 무관)
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StarIndexResponseDto } from '../../lib/types/api';
import { bottomSheetStyle, sheetOverlayStyle, spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from '../ui/Button';
import { GlassCard } from '../ui/GlassCard';

interface SkyStarIndexChromeProps {
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
  scoreLabel: string | null;
  scoreMeasurable: boolean;
  loading: boolean;
  error: string | null;
  starIndex: StarIndexResponseDto | null;
  kstTimeLabel: string;
  onShiftHours: (delta: number) => void;
  onObserveNow: () => void;
  renderEngineLabel: string;
  bottomOffset: number;
}

export function SkyStarIndexChrome({
  visible,
  onOpen,
  onClose,
  scoreLabel,
  scoreMeasurable,
  loading,
  error,
  starIndex,
  kstTimeLabel,
  onShiftHours,
  onObserveNow,
  renderEngineLabel,
  bottomOffset,
}: SkyStarIndexChromeProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const fabScore =
    scoreLabel && scoreMeasurable ? scoreLabel.replace(/[^\d]/g, '') || '—' : '—';

  return (
    <>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: bottomOffset,
            backgroundColor: theme.primary,
            opacity: pressed ? 0.92 : 1,
            shadowColor: theme.primaryGlow,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Star-Index 상세"
      >
        <Text style={[styles.fabScore, { color: theme.primaryForeground }]}>
          {loading ? '…' : fabScore}
        </Text>
        <Text style={[styles.fabSi, { color: theme.primaryForeground }]}>SI</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={sheetOverlayStyle()}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
          <View style={bottomSheetStyle(theme, Math.max(insets.bottom, 16) + 8)}>
            <View style={[styles.grab, { backgroundColor: theme.mutedForeground }]} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.foreground }]}>
                  별 보기 좋은 날 (Star-Index)
                </Text>
                <Text style={[styles.sheetSpot, { color: theme.primaryGlow }]}>
                  {starIndex?.name ? `기준: ${starIndex.name}` : '기준 장소: 현재 위치'}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ color: theme.mutedForeground, fontSize: 20 }}>⌄</Text>
              </Pressable>
            </View>

            <View style={styles.scoreRow}>
              <View style={styles.scoreHero}>
                {loading ? (
                  <ActivityIndicator color={theme.primaryGlow} />
                ) : (
                  <Text
                    style={[
                      styles.heroNum,
                      {
                        color: scoreMeasurable ? theme.primary : theme.destructive,
                      },
                    ]}
                  >
                    {scoreLabel ?? '—'}
                  </Text>
                )}
                <Text style={[styles.heroSub, { color: theme.mutedForeground }]}>오늘</Text>
              </View>
              <View style={styles.hourGrid}>
                {[
                  { label: '-1h', value: '—' },
                  { label: '지금', value: scoreLabel ?? '—' },
                  { label: '+1h', value: '—' },
                ].map((cell) => (
                  <View key={cell.label} style={styles.hourCell}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '300',
                        color:
                          cell.label === '지금' ? theme.primaryGlow : theme.mutedForeground,
                      }}
                    >
                      {cell.value}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.mutedForeground, marginTop: 4 }}>
                      {cell.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {error ? (
                <Text style={{ color: theme.destructive, fontSize: 13, marginBottom: 12 }}>
                  {error}
                </Text>
              ) : null}
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>관측 시각</Text>
              <Text style={[styles.body, { color: theme.mutedForeground }]}>{kstTimeLabel}</Text>

              {starIndex ? (
                <>
                  <Text
                    style={[styles.sectionTitle, { color: theme.foreground, marginTop: 16 }]}
                  >
                    날씨 스냅샷
                  </Text>
                  <Text style={[styles.body, { color: theme.mutedForeground }]}>
                    구름 {starIndex.weatherSnapshot.cloud_score} · PM2.5 관련 점수 반영
                  </Text>
                </>
              ) : null}

              <View style={styles.engineRow}>
                <GlassCard padding={12} style={styles.engineCard}>
                  <Text style={[styles.engineTitle, { color: theme.foreground }]}>
                    고해상도 SVG
                  </Text>
                  <Text style={[styles.engineSub, { color: theme.mutedForeground }]}>
                    라벨 · 별자리 · 벡터
                  </Text>
                </GlassCard>
                <GlassCard padding={12} style={styles.engineCard}>
                  <Text style={[styles.engineTitle, { color: theme.foreground }]}>
                    GPU OpenGL
                  </Text>
                  <Text style={[styles.engineSub, { color: theme.mutedForeground }]}>
                    {renderEngineLabel}
                  </Text>
                </GlassCard>
              </View>
            </ScrollView>

            <View style={[styles.btnRow, { marginTop: spacing.md }]}>
              <Button label="−1h" variant="outline" size="sm" onPress={() => onShiftHours(-1)} />
              <Button label="지금" variant="secondary" size="sm" onPress={onObserveNow} />
              <Button label="+1h" variant="outline" size="sm" onPress={() => onShiftHours(1)} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  fabScore: { fontSize: 20, fontWeight: '300', lineHeight: 22 },
  fabSi: { fontSize: 8, fontWeight: '600', letterSpacing: 0.5, marginTop: -2 },
  grab: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
    opacity: 0.35,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sheetSpot: { fontSize: 13 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.lg,
  },
  scoreHero: { flex: 1, alignItems: 'center' },
  heroNum: { fontSize: 56, fontWeight: '300', lineHeight: 60 },
  heroSub: { fontSize: 13, marginTop: 4 },
  hourGrid: { flex: 1, flexDirection: 'row' },
  hourCell: { flex: 1, alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  body: { fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.lg },
  engineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  engineCard: { flex: 1 },
  engineTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  engineSub: { fontSize: 11, lineHeight: 15 },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
});
