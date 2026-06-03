/**
 * 시트 상단 — STARCHASER 브랜딩 (로고 이미지 없음)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

interface AuthBrandHeaderProps {
  subtitle: string;
  compact?: boolean;
}

export function AuthBrandHeader({ subtitle, compact = false }: AuthBrandHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text
        style={[
          styles.brand,
          compact && styles.brandCompact,
          { color: theme.foreground },
        ]}
      >
        STARCHASER
      </Text>
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: theme.primaryGlowBorder }]} />
        <View style={[styles.dividerDot, { backgroundColor: theme.primaryGlow }]} />
        <View style={[styles.dividerLine, { backgroundColor: theme.primaryGlowBorder }]} />
      </View>
      <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  wrapCompact: {
    marginBottom: spacing.sm,
  },
  brand: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 22,
    letterSpacing: 5,
    textShadowColor: 'rgba(141, 220, 255, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  brandCompact: {
    fontSize: 19,
    letterSpacing: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 180,
    marginTop: 2,
    marginBottom: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.65,
  },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  subtitle: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
