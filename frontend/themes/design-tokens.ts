/**
 * StarChaser — Figma Redesign 디자인 토큰 (spacing · typography · glass)
 * StyleSheet에서는 themes.ts + 이 파일만 참조
 */

import type { ThemeTokens } from './themes';
import type { TextStyle, ViewStyle } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  hero: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySm: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '500' as const },
  tab: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.2 },
} as const;

/** 반투명 글래스 카드 (Figma card / deep-navy 시트) */
export function glassCardStyle(theme: ThemeTokens, overrides?: ViewStyle): ViewStyle {
  return {
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radiusLg,
    ...overrides,
  };
}

/** 글래스 인풋 필드 */
export function glassInputShellStyle(theme: ThemeTokens, focused: boolean, hasError: boolean): ViewStyle {
  return {
    backgroundColor: theme.inputBackground,
    borderColor: hasError ? theme.destructive : focused ? theme.primaryGlow : theme.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radiusLg,
  };
}

/** Figma 로그인·CTA 버튼 (아이스 글로우 아웃라인) */
export function primaryGlowButtonStyle(theme: ThemeTokens, pressed: boolean): ViewStyle {
  return {
    backgroundColor: theme.primaryGlowMuted,
    borderColor: theme.primaryGlowBorder,
    borderWidth: 1,
    borderRadius: theme.radiusLg,
    opacity: pressed ? 0.88 : 1,
  };
}

export function sheetOverlayStyle(): ViewStyle {
  return {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  };
}

export function bottomSheetStyle(theme: ThemeTokens, paddingBottom: number): ViewStyle {
  return {
    backgroundColor: theme.deepNavy,
    borderTopLeftRadius: theme.radiusXl,
    borderTopRightRadius: theme.radiusXl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.cardBorder,
    paddingBottom,
    paddingTop: spacing.sm,
  };
}

export function screenHeaderText(color: string): TextStyle {
  return {
    ...typography.h2,
    color,
  };
}

export function screenSubheaderText(color: string): TextStyle {
  return {
    ...typography.caption,
    color,
    marginTop: 4,
  };
}
