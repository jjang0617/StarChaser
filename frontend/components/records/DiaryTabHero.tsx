import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

const textShadowStrong = {
  textShadowColor: 'rgba(0,0,0,0.85)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
} as const;

/** SKY 인트로와 동일 — 박스·테두리 없이 타이틀만 */
export function DiaryTabHero() {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.iconRow}>
        <Feather name="book-open" size={26} color={theme.primaryGlow} />
      </View>

      <View style={styles.headlineBlock}>
        <Text
          style={[
            styles.headline,
            { color: theme.foreground },
            textShadowStrong,
          ]}
        >
          관측{' '}
          <Text style={[styles.headlineAccent, { color: theme.primaryGlow }]}>
            일기
          </Text>
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: theme.mutedForeground },
            textShadowStrong,
          ]}
        >
          오늘의 밤하늘을 기록해 보세요.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  iconRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -4,
  },
  headlineBlock: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: spacing.sm,
  },
  headline: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 34,
  },
  headlineAccent: {
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 4,
  },
});
