/**
 * StarChaser — Button
 * Anti-AI: Shadow 없음 · Border 중심 · opacity 물리 반응
 * mono prop: Space Mono (수치 표시 버튼용)
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../themes/ThemeContext';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'red'
  | 'destructive';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  label:      string;
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  mono?:      boolean;
  fullWidth?: boolean;
  style?:     ViewStyle;
}

export function Button({
  label,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  mono      = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { theme } = useTheme();

  const variantStyle = {
    primary: {
      bg:     theme.primary,
      text:   theme.primaryForeground,
      border: theme.primary,
    },
    secondary: {
      bg:     theme.secondary,
      text:   theme.secondaryForeground,
      border: theme.border,
    },
    outline: {
      bg:     'transparent',
      text:   theme.foreground,
      border: theme.border,
    },
    ghost: {
      bg:     'transparent',
      text:   theme.mutedForeground,
      border: 'transparent',
    },
    red: {
      bg:     theme.dimRed,
      text:   '#FFFFFF',
      border: theme.dimRed,
    },
    destructive: {
      bg:     'transparent',
      text:   theme.destructive,
      border: 'transparent',
    },
  }[variant];

  const sizeStyle = {
    sm: { paddingVertical: 6,  paddingHorizontal: 10, fontSize: 12 },
    md: { paddingVertical: 10, paddingHorizontal: 14, fontSize: 14 },
    lg: { paddingVertical: 13, paddingHorizontal: 20, fontSize: 15 },
  }[size];

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor:   variantStyle.bg,
          borderColor:       variantStyle.border,
          borderWidth:       variant === 'ghost' || variant === 'destructive' ? 0 : 1,
          borderRadius:      theme.radius,
          paddingVertical:   sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          opacity:           disabled ? 0.45 : pressed ? 0.82 : 1,
          alignSelf:         fullWidth ? 'stretch' : 'flex-start',
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
              color:         variantStyle.text,
              fontSize:      sizeStyle.fontSize,
              fontFamily:    mono ? 'SpaceMono-Regular' : undefined,
              fontWeight:    variant === 'primary' ? '600' : '500',
              letterSpacing: mono ? 0.5 : 0.1,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems:     'center',
    flexDirection:  'row',
    justifyContent: 'center',
    gap:             6,
    // ⚠️ elevation/shadowColor 없음 — Anti-AI
  },
  label: {
    textAlign: 'center',
  },
});
