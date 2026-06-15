/**
 * Star-Index 캐시·API 대기 — MAIN 탭과 동일한 측정 중 연출
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedStarIndexGauge, MeasuringDots } from '../main/AnimatedStarIndexGauge';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

interface StarIndexMeasuringPanelProps {
  /** 모달·카드 안 소형 배치 */
  compact?: boolean;
  title?: string;
  hint?: string;
}

export function StarIndexMeasuringPanel({
  compact = false,
  title = '점수 측정 중이에요',
  hint = '구름·미세먼지·달빛·빛공해를 살펴보고 있어요',
}: StarIndexMeasuringPanelProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.headlineBlock}>
        <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
        <View style={styles.dotsRow}>
          <MeasuringDots color={theme.primaryGlow} />
        </View>
        <Text style={[styles.hint, { color: theme.mutedForeground }]}>{hint}</Text>
      </View>
      {!compact ? (
        <AnimatedStarIndexGauge loading />
      ) : (
        <View style={[styles.compactRing, { borderColor: theme.cardBorder }]}>
          <MeasuringDots color={theme.mutedForeground} />
          <Text style={[styles.compactCaption, { color: theme.mutedForeground }]}>
            MEASURING
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  wrapCompact: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  headlineBlock: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  dotsRow: {
    marginVertical: 2,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  compactRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  compactCaption: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '600',
  },
});
