import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

const DISMISS_MS = 2600;

interface BottomToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
}

/** 하단 탭 위 짧은 알림 */
export function BottomToast({ visible, message, onHide }: BottomToastProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!visible) return;

    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 8,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onHide();
      });
    }, DISMISS_MS);

    return () => clearTimeout(timer);
  }, [visible, message, onHide, opacity, translateY]);

  if (!visible) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }],
            marginBottom: insets.bottom + 72,
            backgroundColor: theme.deepNavy,
            borderColor: theme.primaryGlowBorder,
          },
        ]}
      >
        <Feather name="check-circle" size={18} color={theme.primaryGlow} />
        <Text style={[styles.text, { color: theme.foreground }]}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
});
