/**
 * StarChaser — Button
 * Figma: 아이스 글로우 아웃라인 primary · 둥근 xl 모서리
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { AppPressable } from './AppPressable';
import { primaryGlowButtonStyle } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'red'
  | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  mono?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  mono = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { theme } = useTheme();

  const variantStyle = {
    primary: {
      bg: theme.primaryGlowMuted,
      text: theme.foreground,
      border: theme.primaryGlowBorder,
    },
    secondary: {
      bg: 'rgba(93, 173, 235, 0.15)',
      text: theme.secondary,
      border: 'rgba(93, 173, 235, 0.35)',
    },
    outline: {
      bg: 'transparent',
      text: theme.foreground,
      border: theme.cardBorder,
    },
    ghost: {
      bg: 'transparent',
      text: theme.mutedForeground,
      border: 'transparent',
    },
    red: {
      bg: theme.dimRed,
      text: '#FFFFFF',
      border: theme.dimRed,
    },
    destructive: {
      bg: 'transparent',
      text: theme.destructive,
      border: 'transparent',
    },
  }[variant];

  const sizeStyle = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 13 },
    md: { paddingVertical: 12, paddingHorizontal: 16, fontSize: 14 },
    lg: { paddingVertical: 14, paddingHorizontal: 20, fontSize: 15 },
  }[size];

  return (
    <AppPressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary'
          ? {
              ...primaryGlowButtonStyle(theme, Boolean(pressed && !disabled)),
              paddingVertical: sizeStyle.paddingVertical,
              paddingHorizontal: sizeStyle.paddingHorizontal,
              opacity: disabled ? 0.45 : 1,
              alignSelf: fullWidth ? 'stretch' : 'flex-start',
            }
          : {
              backgroundColor: variantStyle.bg,
              borderColor: variantStyle.border,
              borderWidth:
                variant === 'ghost' || variant === 'destructive' ? 0 : 1,
              borderRadius: theme.radiusLg,
              paddingVertical: sizeStyle.paddingVertical,
              paddingHorizontal: sizeStyle.paddingHorizontal,
              opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
              alignSelf: fullWidth ? 'stretch' : 'flex-start',
            },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.text} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: variantStyle.text,
              fontSize: sizeStyle.fontSize,
              fontFamily: mono ? 'SpaceMono-Regular' : undefined,
              fontWeight: '500',
              letterSpacing: mono ? 0.5 : 0.1,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    textAlign: 'center',
  },
});
