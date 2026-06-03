/**
 * 로그인 / 회원가입 — 시트 상단 탭
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

interface AuthSegmentTabsProps {
  active: 'login' | 'register';
  onLogin: () => void;
  onRegister: () => void;
}

export function AuthSegmentTabs({ active, onLogin, onRegister }: AuthSegmentTabsProps) {
  const { theme } = useTheme();

  const item = (
    key: 'login' | 'register',
    label: string,
    onPress: () => void,
  ) => {
    const isActive = active === key;
    return (
      <Pressable onPress={onPress} style={styles.item}>
        <Text
          style={[
            styles.label,
            {
              color: isActive ? theme.foreground : theme.mutedForeground,
              fontWeight: isActive ? '600' : '400',
            },
          ]}
        >
          {label}
        </Text>
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: isActive ? theme.primaryGlow : 'transparent',
              opacity: isActive ? 1 : 0,
            },
          ]}
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.row}>
      {item('login', '로그인', onLogin)}
      {item('register', '회원가입', onRegister)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: 8,
  },
  label: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  indicator: {
    width: 28,
    height: 2,
    borderRadius: 1,
  },
});
