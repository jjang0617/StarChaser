/**
 * Figma AuthTabs — 로그인 / 회원가입 세그먼트
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../themes/ThemeContext';

interface AuthSegmentTabsProps {
  active: 'login' | 'register';
  onLogin: () => void;
  onRegister: () => void;
}

export function AuthSegmentTabs({ active, onLogin, onRegister }: AuthSegmentTabsProps) {
  const { theme } = useTheme();

  const seg = (key: 'login' | 'register', label: string, onPress: () => void) => {
    const isActive = active === key;
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.seg,
          isActive && {
            backgroundColor: theme.primaryGlowMuted,
            borderColor: theme.primaryGlowBorder,
            borderWidth: 1,
          },
        ]}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: isActive ? theme.primaryGlow : theme.mutedForeground,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
      ]}
    >
      {seg('login', '로그인', onLogin)}
      {seg('register', '회원가입', onRegister)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    alignSelf: 'flex-start',
  },
  seg: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
});
