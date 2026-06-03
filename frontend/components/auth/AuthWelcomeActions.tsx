/**
 * 웰컴 화면 — 하단 로그인 / 회원가입 CTA
 */

import React from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

interface AuthWelcomeActionsProps {
  onLogin: () => void;
  onRegister: () => void;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'box-none' | 'none' | 'auto' | 'box-only';
}

export function AuthWelcomeActions({
  onLogin,
  onRegister,
  style,
  pointerEvents = 'box-none',
}: AuthWelcomeActionsProps) {
  const { theme } = useTheme();

  return (
    <Animated.View style={[styles.wrap, style]} pointerEvents={pointerEvents}>
      <View
        style={[
          styles.dock,
          {
            borderColor: theme.primaryGlowBorder,
            backgroundColor: 'rgba(6, 12, 24, 0.52)',
          },
        ]}
      >
        <View style={[styles.dockGlow, { backgroundColor: theme.primaryGlow }]} />
        <View style={styles.row}>
          <Pressable
            onPress={onLogin}
            style={({ pressed }) => [
              styles.btn,
              {
                borderColor: 'rgba(141, 220, 255, 0.62)',
                backgroundColor: pressed
                  ? 'rgba(141, 220, 255, 0.2)'
                  : 'rgba(141, 220, 255, 0.1)',
              },
            ]}
          >
            <Text style={[styles.btnLabel, { color: theme.foreground }]}>로그인</Text>
          </Pressable>

          <Pressable
            onPress={onRegister}
            style={({ pressed }) => [
              styles.btn,
              styles.signupBtn,
              {
                borderColor: theme.primaryGlow,
                backgroundColor: pressed
                  ? 'rgba(141, 220, 255, 0.42)'
                  : 'rgba(141, 220, 255, 0.3)',
                ...(Platform.OS === 'ios'
                  ? {
                      shadowColor: theme.primaryGlow,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: pressed ? 0.35 : 0.55,
                      shadowRadius: 14,
                    }
                  : {}),
              },
            ]}
          >
            <Text style={[styles.btnLabel, styles.signupLabel, { color: '#F8FAFC' }]}>
              회원가입
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  dock: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  dockGlow: {
    position: 'absolute',
    top: 0,
    left: '18%',
    right: '18%',
    height: 1,
    opacity: 0.55,
    borderRadius: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  btn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
  },
  signupBtn: {
    elevation: 6,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  signupLabel: {
    fontWeight: '700',
    textShadowColor: 'rgba(141, 220, 255, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
