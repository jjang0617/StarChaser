/**
 * StarChaser — Screen
 * Figma: background #030712 · safe area
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

const DEFAULT_EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

interface ScreenProps {
  children:    ReactNode;
  noPadding?:  boolean;
  /** 인트로·풀블리드 탭 — 뒤 레이어(지도·하늘)가 비치도록 */
  transparent?: boolean;
  /** 상단 safe area 제외 시 지도·하늘이 상태바 아래까지 이어짐 */
  edges?: Edge[];
}

export function Screen({
  children,
  noPadding = false,
  transparent = false,
  edges = DEFAULT_EDGES,
}: ScreenProps) {
  const { theme } = useTheme();
  const bg = transparent ? 'transparent' : theme.background;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safe, { backgroundColor: bg }]}
    >
      <View
        style={[
          styles.inner,
          { backgroundColor: bg },
          noPadding && styles.noPadding,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  inner: {
    flex:             1,
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
  },
  noPadding: {
    paddingHorizontal: 0,
    paddingTop:        0,
  },
});
