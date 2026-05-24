/**
 * StarChaser — Screen
 * Figma: background #030712 · safe area
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

interface ScreenProps {
  children:    ReactNode;
  noPadding?:  boolean;
}

export function Screen({ children, noPadding = false }: ScreenProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.inner,
          { backgroundColor: theme.background },
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
