/**
 * 시트 하단 주요 액션 버튼
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

interface AuthSubmitButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function AuthSubmitButton({
  label,
  loading = false,
  disabled = false,
  onPress,
}: AuthSubmitButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: pressed
            ? 'rgba(141, 220, 255, 0.22)'
            : theme.primaryGlowMuted,
          borderColor: theme.primaryGlowBorder,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.foreground} />
      ) : (
        <Text style={[styles.label, { color: theme.foreground }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
