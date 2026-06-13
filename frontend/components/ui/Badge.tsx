/**
 * StarChaser — Badge
 * Figma: pill · 아이스 글로우 / 블루그레이 변형
 */

import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../themes/ThemeContext';

export type BadgeVariant = 'gold' | 'glow' | 'bronze' | 'steel' | 'muted' | 'red' | 'outline';

interface BadgeProps {
  label:    string;
  variant?: BadgeVariant;
  mono?:    boolean;
  style?:   ViewStyle;
}

export function Badge({ label, variant = 'muted', mono = false, style }: BadgeProps) {
  const { theme } = useTheme();

  const resolved = variant === 'gold' ? 'glow' : variant;

  const variantStyle = {
    glow: {
      bg:     theme.primaryGlowMuted,
      text:   theme.primaryGlow,
      border: theme.primaryGlowBorder,
    },
    bronze: {
      bg:     'rgba(93, 173, 235, 0.12)',
      text:   theme.secondary,
      border: 'rgba(93, 173, 235, 0.35)',
    },
    steel: {
      bg:     'rgba(100, 116, 139, 0.2)',
      text:   theme.moonlight,
      border: 'rgba(148, 163, 184, 0.35)',
    },
    muted: {
      bg:     theme.muted,
      text:   theme.mutedForeground,
      border: theme.borderSubtle,
    },
    red: {
      bg:     theme.dimRed + '1F',
      text:   theme.dimRedFg,
      border: theme.dimRed + '4D',
    },
    outline: {
      bg:     'transparent',
      text:   theme.mutedForeground,
      border: theme.cardBorder,
    },
  }[resolved];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: variantStyle.bg,
          borderColor:     variantStyle.border,
          borderRadius:    theme.radiusSm,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color:      variantStyle.text,
            fontFamily: mono ? 'SpaceMono-Regular' : undefined,
            letterSpacing: mono ? 0.4 : 0.1,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf:         'flex-start',
    borderWidth:       1,
    paddingVertical:   3,
    paddingHorizontal: 8,
  },
  label: {
    fontSize:   11,
    fontWeight: '500',
  },
});
