/**
 * ME 탭 섹션 — 제목은 카드 왼쪽 상단(외부), 본문은 GlassCard
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '../../themes/design-tokens';
import type { ThemeTokens } from '../../themes/themes';

export function ProfileSection({
  title,
  theme,
  children,
}: {
  /** 없으면 제목 줄만 생략(간격은 동일) */
  title?: string;
  theme: ThemeTokens;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
});
