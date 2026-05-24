/**
 * Figma SkyScreen — 주간 TOP3 (글래스 · 2줄 레이아웃)
 */

import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { WeeklyTop3ItemDto } from '../../lib/types/api';
import { getStarIndexScoreDisplay } from '../../lib/star-index-display';
import { spotNameWithoutRegionPrefix } from '../../lib/spot-display-name';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import type { ThemeTokens } from '../../themes/themes';
import { GlassCard } from '../ui/GlassCard';

interface SkyTop3PanelProps {
  top: number;
  maxWidth: number;
  top3Loading: boolean;
  top3Error: string | null;
  top3Items: WeeklyTop3ItemDto[] | null;
  selectedSpotId: string | null;
  onSelectTop3Spot: (spotId: string) => void;
}

function rankBadgeStyle(rank: number, theme: ThemeTokens) {
  if (rank === 1) {
    return {
      bg: theme.primary,
      text: theme.primaryForeground,
      border: 'transparent' as const,
      glow: true,
    };
  }
  if (rank === 2) {
    return {
      bg: 'rgba(93, 173, 235, 0.25)',
      text: theme.secondary,
      border: 'rgba(93, 173, 235, 0.4)',
      glow: false,
    };
  }
  return {
    bg: theme.muted,
    text: theme.mutedForeground,
    border: theme.cardBorder,
    glow: false,
  };
}

function formatTop3Score(avgStarIndex: number): string {
  const d = getStarIndexScoreDisplay(avgStarIndex);
  if (!d.measurable) return d.label;
  const n = Number(avgStarIndex);
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n * 100) / 100;
  if (r % 1 === 0) return String(Math.round(r));
  return r.toFixed(2).replace(/\.?0+$/, '');
}

export function SkyTop3Panel({
  top,
  maxWidth,
  top3Loading,
  top3Error,
  top3Items,
  selectedSpotId,
  onSelectTop3Spot,
}: SkyTop3PanelProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, { top, width: maxWidth }]} pointerEvents="box-none">
      <GlassCard glow padding={10} style={styles.card}>
        <View style={styles.header}>
          <Feather name="trending-up" size={14} color={theme.primaryGlow} />
          <Text style={[styles.title, { color: theme.foreground }]}>주간 TOP3</Text>
        </View>

        {top3Loading ? (
          <ActivityIndicator size="small" color={theme.primaryGlow} style={styles.loader} />
        ) : top3Error ? (
          <Text style={[styles.meta, { color: theme.destructive }]} numberOfLines={3}>
            {top3Error}
          </Text>
        ) : top3Items == null || top3Items.length === 0 ? (
          <Text style={[styles.meta, { color: theme.mutedForeground }]}>데이터 없음</Text>
        ) : (
          <View style={styles.list}>
            {top3Items.map((item) => {
              const selected = selectedSpotId === item.spotId;
              const displayName = spotNameWithoutRegionPrefix(item.spotName);
              const badge = rankBadgeStyle(item.rank, theme);
              const scoreStr = formatTop3Score(item.avgStarIndex);
              const topSi = getStarIndexScoreDisplay(item.avgStarIndex);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => onSelectTop3Spot(item.spotId)}
                  style={({ pressed }) => [
                    styles.item,
                    selected && {
                      backgroundColor: theme.primaryGlowMuted,
                      borderRadius: 10,
                    },
                    pressed && { opacity: 0.88 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.rank}위 ${displayName} ${scoreStr}점`}
                >
                  <View style={styles.topRow}>
                    <View
                      style={[
                        styles.rankCircle,
                        {
                          backgroundColor: badge.bg,
                          borderColor: badge.border,
                          borderWidth: badge.border === 'transparent' ? 0 : 1,
                        },
                        badge.glow && {
                          shadowColor: theme.primary,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.4,
                          shadowRadius: 10,
                          elevation: 3,
                        },
                      ]}
                    >
                      <Text style={[styles.rankNum, { color: badge.text }]}>{item.rank}</Text>
                    </View>
                    <Text
                      style={[
                        styles.score,
                        {
                          color: topSi.measurable ? theme.primaryGlow : theme.destructive,
                          textShadowColor: topSi.measurable
                            ? 'rgba(141, 220, 255, 0.4)'
                            : 'transparent',
                          textShadowOffset: { width: 0, height: 0 },
                          textShadowRadius: 8,
                        },
                      ]}
                    >
                      {scoreStr}
                    </Text>
                  </View>
                  <Text
                    style={[styles.name, { color: theme.foreground }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {displayName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: spacing.sm,
    zIndex: 20,
  },
  card: {
    width: '100%',
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  title: { fontSize: 14, fontWeight: '500' },
  loader: { marginVertical: 6 },
  meta: { fontSize: 11 },
  list: { gap: 8 },
  item: {
    width: '100%',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  rankCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankNum: { fontSize: 11, fontWeight: '600' },
  score: {
    fontSize: 14,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  name: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    width: '100%',
  },
});
