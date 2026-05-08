/**
 * StarChaser — Badge
 * Anti-AI: 채도 낮은 팔레트 · 각진 radius · Glow 없음
 * 수치 뱃지(Bortle, 고도)는 mono prop으로 Space Mono 적용
 */

import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../themes/ThemeContext';

export type BadgeVariant = 'gold' | 'bronze' | 'steel' | 'muted' | 'red' | 'outline';

interface BadgeProps {
  label:    string;
  variant?: BadgeVariant;
  mono?:    boolean;   // Space Mono — 수치 데이터 뱃지용
  style?:   ViewStyle;
}

export function Badge({ label, variant = 'muted', mono = false, style }: BadgeProps) {
  const { theme } = useTheme();

  // variant별 배경/텍스트/테두리 — 채도 낮게
  const variantStyle = {
    gold: {
      bg:     theme.starGold + '1A',  // 10% alpha
      text:   theme.starGold,
      border: theme.starGold + '45',  // 27% alpha
    },
    bronze: {
      // 테마 토큰에 없어서 고정 hex 사용 (Blue/Green 없음)
      bg:     '#7A4A2A14',   // ~8% alpha
      text:   '#A8643A',     // muted copper
      border: '#7A4A2A52',   // ~32% alpha
    },
    steel: {
      bg:     theme.nebulaSteel + '26',
      text:   theme.moonlight,
      border: theme.nebulaSteel + '59',
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
      border: theme.border,
    },
  }[variant];

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
    paddingVertical:   2,
    paddingHorizontal: 7,
  },
  label: {
    fontSize:   11,
    fontWeight: '500',
  },
});
