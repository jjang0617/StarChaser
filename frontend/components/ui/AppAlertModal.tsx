/**
 * 글래스 스타일 확인·알림 모달
 */

import Feather from '@expo/vector-icons/Feather';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { glassCardStyle, spacing, typography } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from './Button';

export type AppAlertModalTone = 'default' | 'success' | 'danger';

interface AppAlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  tone?: AppAlertModalTone;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onRequestClose?: () => void;
  /** primary만 있을 때 자동 닫힘(ms). 0이면 비활성 */
  autoDismissMs?: number;
}

const ICON: Record<AppAlertModalTone, React.ComponentProps<typeof Feather>['name']> = {
  default: 'info',
  success: 'check-circle',
  danger: 'log-out',
};

export function AppAlertModal({
  visible,
  title,
  message,
  tone = 'default',
  primaryLabel = '확인',
  secondaryLabel,
  onPrimary,
  onSecondary,
  onRequestClose,
  autoDismissMs = 0,
}: AppAlertModalProps) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(0.94)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.94);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, scale]);

  useEffect(() => {
    if (!visible || !autoDismissMs || !onPrimary) return;
    const timer = setTimeout(() => onPrimary(), autoDismissMs);
    return () => clearTimeout(timer);
  }, [visible, autoDismissMs, onPrimary]);

  const accent =
    tone === 'success'
      ? theme.primaryGlow
      : tone === 'danger'
        ? theme.destructive
        : theme.primaryGlow;

  const handleClose = onRequestClose ?? onSecondary ?? onPrimary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Pressable
            style={[styles.sheet, glassCardStyle(theme, { borderRadius: 20 })]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: theme.primaryGlowMuted,
                  borderColor: theme.primaryGlowBorder,
                },
              ]}
            >
              <Feather name={ICON[tone]} size={22} color={accent} />
            </View>

            <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
            {message ? (
              <Text style={[styles.message, { color: theme.mutedForeground }]}>
                {message}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {secondaryLabel && onSecondary ? (
                <Button
                  label={secondaryLabel}
                  variant="outline"
                  size="sm"
                  onPress={onSecondary}
                  style={styles.actionBtn}
                />
              ) : null}
              {onPrimary ? (
                <Button
                  label={primaryLabel}
                  variant={tone === 'danger' ? 'outline' : 'primary'}
                  size="sm"
                  onPress={onPrimary}
                  style={styles.actionBtn}
                />
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 320,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
  },
  message: {
    ...typography.bodySm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
