import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import * as Location from 'expo-location';
import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from '../ui';
import { GlassCard } from '../ui/GlassCard';

interface SkyObserverEmptyStateProps {
  locationFeaturesEnabled?: boolean;
  locationPermissionStatus?: Location.PermissionResponse['status'] | null;
  onRequestLocationPermission?: () => void | Promise<void>;
}

export function SkyObserverEmptyState({
  locationFeaturesEnabled = false,
  locationPermissionStatus = null,
  onRequestLocationPermission,
}: SkyObserverEmptyStateProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const locDenied =
    Platform.OS !== 'web' &&
    locationPermissionStatus === Location.PermissionStatus.DENIED;
  const showPermissionCard =
    Platform.OS !== 'web' &&
    locationFeaturesEnabled &&
    locationPermissionStatus != null &&
    locationPermissionStatus !== Location.PermissionStatus.GRANTED;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      <View style={styles.centerBlock}>
        <View style={[styles.iconRing, { borderColor: theme.primaryGlowBorder }]}>
          <Ionicons name="sparkles" size={36} color={theme.primaryGlow} />
        </View>

        <Text style={[styles.title, { color: theme.foreground }]}>가상 밤하늘</Text>
        <Text style={[styles.sub, { color: theme.mutedForeground }]}>
          위치를 허용하면 지금 서 있는 곳의{'\n'}천구가 화면을 채웁니다.
        </Text>

        <GlassCard glow padding={spacing.lg} style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="map-pin" size={18} color={theme.primaryGlow} />
            <Text style={[styles.cardTitle, { color: theme.foreground }]}>
              관측 위치가 필요해요
            </Text>
          </View>
          <Text style={[styles.cardBody, { color: theme.mutedForeground }]}>
            위치 권한을 허용하거나 MAIN·지도에서 명소를 고르면 별자리와 행성을 볼 수
            있어요.
          </Text>

          {showPermissionCard ? (
            <View style={[styles.permissionBlock, { borderTopColor: theme.borderSubtle }]}>
              <Text style={[styles.permissionHint, { color: theme.mutedForeground }]}>
                {locDenied
                  ? '이전에 거부하셨다면 시스템 설정에서 위치를 켜 주세요.'
                  : '아래에서 허용하면 OS 위치 권한 창이 뜹니다.'}
              </Text>
              {!locDenied ? (
                <Button
                  label="위치 권한 허용"
                  variant="secondary"
                  size="sm"
                  onPress={() => void onRequestLocationPermission?.()}
                />
              ) : (
                <Button
                  label="시스템 설정 열기"
                  variant="outline"
                  size="sm"
                  onPress={() => void Linking.openSettings()}
                />
              )}
            </View>
          ) : null}
        </GlassCard>

        <Text style={[styles.footerHint, { color: theme.mutedForeground }]}>
          GPS가 꺼져 있으면 기본 명소 좌표로도 볼 수 있어요.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 360,
    width: '100%',
    alignSelf: 'center',
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(141, 220, 255, 0.06)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  card: {
    width: '100%',
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  permissionBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  permissionHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  footerHint: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    opacity: 0.75,
    paddingHorizontal: spacing.sm,
  },
});
