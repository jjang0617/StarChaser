/**
 * Figma MapScreen — 플로팅 위치·광공해 컨트롤 (지도 WebView 위 오버레이)
 */

import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../themes/design-tokens';
import type { ThemeTokens } from '../../themes/themes';

interface MapFloatingControlsProps {
  theme: ThemeTokens;
  viirsEnabled: boolean;
  onToggleViirs: () => void;
  onMyLocation: () => void;
  locationReady: boolean;
}

export function MapFloatingControls({
  theme,
  viirsEnabled,
  onToggleViirs,
  onMyLocation,
  locationReady,
}: MapFloatingControlsProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        onPress={onMyLocation}
        style={({ pressed }) => [
          styles.locBtn,
          {
            top: Math.max(insets.top, 8) + spacing.sm,
            backgroundColor: theme.deepNavy,
            borderColor: theme.cardBorder,
            opacity: pressed ? 0.88 : locationReady ? 1 : 0.75,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="내 위치로 이동"
      >
        <Feather name="navigation" size={20} color={theme.primaryGlow} />
      </Pressable>

      <Pressable
        onPress={onToggleViirs}
        style={({ pressed }) => [
          styles.viirsBtn,
          viirsEnabled
            ? {
                backgroundColor: theme.deepNavy,
                borderColor: theme.primaryGlow,
                borderWidth: 1.5,
              }
            : {
                backgroundColor: theme.deepNavy,
                borderColor: 'rgba(141, 220, 255, 0.45)',
                borderWidth: 1.5,
              },
          pressed && { opacity: 0.92 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={viirsEnabled ? '광공해 끄기' : '광공해 켜기'}
      >
        <MaterialCommunityIcons
          name={viirsEnabled ? 'lightbulb-on' : 'lightbulb-outline'}
          size={18}
          color={theme.primaryGlow}
        />
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: theme.primaryGlow,
          }}
        >
          광공해 {viirsEnabled ? '끄기' : '켜기'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  locBtn: {
    position: 'absolute',
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viirsBtn: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
