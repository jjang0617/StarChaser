/**
 * Figma GlassCard — 반투명 글래스 카드
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../themes/ThemeContext';

interface GlassCardProps {
  children: ReactNode;
  style?: ViewStyle;
  /** 아이스 글로우 외곽 */
  glow?: boolean;
  padding?: number;
}

export function GlassCard({ children, style, glow = false, padding = 12 }: GlassCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          borderRadius: theme.radiusLg,
          padding,
        },
        glow && styles.glow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  glow: {
    shadowColor: '#8DDCFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
});
