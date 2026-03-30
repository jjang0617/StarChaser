/**
 * StarChaser — Screen
 * 모든 화면의 기본 래퍼. ThemeProvider에서 배경색 가져옴.
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../themes/ThemeContext';

interface ScreenProps {
  children:    ReactNode;
  noPadding?:  boolean;   // 지도 화면 등 full-bleed 용
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
    paddingHorizontal: 16,
    paddingTop:        20,
  },
  noPadding: {
    paddingHorizontal: 0,
    paddingTop:        0,
  },
});
