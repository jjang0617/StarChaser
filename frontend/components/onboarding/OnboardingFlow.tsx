/**
 * 온보딩 — 회원가입 직후 권한·알림 안내 (로그인 시트와 동일 UI)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { spacing, typography } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { authorizedPutJson } from '../../lib/api-client';
import { notificationPrefsKey, onboardingCompletedKey } from '../../lib/auth-storage';
import { saveLocationEnabled } from '../../lib/location-preferences';
import { AuthBrandHeader } from '../auth/AuthBrandHeader';
import { AUTH_SHEET_BG, authSheetStyles } from '../auth/auth-sheet-styles';
import { AuthSubmitButton } from '../auth/AuthSubmitButton';
import { AuthWelcomeBackdrop } from '../auth/AuthWelcomeBackdrop';
import { GlassCard } from '../ui/GlassCard';
import { Screen } from '../ui/Screen';

const NOTIF_INFO_ITEMS = [
  {
    icon: '📍',
    title: '위치한 곳 알림',
    desc: '지금 계신 곳의 Star-Index가 좋아지면 하루 1회 알려 드려요.',
  },
  {
    icon: '★',
    title: '기준 명소 알림',
    desc: '기준 명소 점수가 올라가면 하루 1회 알려 드려요.',
  },
] as const;

const SHEET_CLOSED_Y = Dimensions.get('window').height;

export function OnboardingFlow({
  onDone,
  userId,
}: {
  onDone: () => void;
  userId: string;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionResponse['status'] | null>(null);

  const sheetY = useRef(new Animated.Value(SHEET_CLOSED_Y)).current;
  const brandReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((r) => {
      setPermissionStatus(r.status);
    });
  }, []);

  useEffect(() => {
    brandReveal.setValue(0);
    Animated.parallel([
      Animated.spring(sheetY, {
        toValue: 0,
        friction: 8,
        tension: 68,
        useNativeDriver: true,
      }),
      Animated.spring(brandReveal, {
        toValue: 1,
        friction: 7,
        tension: 90,
        delay: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [brandReveal, sheetY]);

  const brandScale = brandReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });

  const locationStatusHint = (() => {
    if (permissionStatus === Location.PermissionStatus.GRANTED) {
      return '위치 권한이 허용되었어요. 현재 위치 기준 점수를 사용할 수 있어요.';
    }
    if (permissionStatus === Location.PermissionStatus.DENIED) {
      return '권한이 거부되었어요. 나중에 마이페이지(ME) 또는 시스템 설정에서 허용할 수 있어요.';
    }
    return null;
  })();

  const requestLocation = useCallback(async () => {
    setLocationBusy(true);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(result.status);
      if (result.status === Location.PermissionStatus.GRANTED) {
        await saveLocationEnabled(userId, true);
      } else {
        await saveLocationEnabled(userId, false);
      }
    } finally {
      setLocationBusy(false);
    }
  }, [userId]);

  const openLocationSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const finishOnboarding = useCallback(async () => {
    setBusy(true);
    const defaultPrefs = { starIndex90: false };
    try {
      if (permissionStatus !== Location.PermissionStatus.GRANTED) {
        await saveLocationEnabled(userId, false);
      }

      await Promise.all([
        AsyncStorage.setItem(onboardingCompletedKey(userId), 'true'),
        AsyncStorage.setItem(
          notificationPrefsKey(userId),
          JSON.stringify(defaultPrefs),
        ),
      ]);

      try {
        await authorizedPutJson('/notifications/preferences', {
          alertsEnabled: false,
          starIndexAlertEnabled: false,
          locationStarIndexAlertEnabled: false,
        });
      } catch (e) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[OnboardingFlow] 알림 기본값 동기화 실패(온보딩은 완료됨)', e);
        }
      }

      onDone();
    } finally {
      setBusy(false);
    }
  }, [onDone, permissionStatus, userId]);

  return (
    <Screen transparent noPadding edges={[]}>
      <StatusBar style="light" />
      <AuthWelcomeBackdrop />

      <Animated.View
        style={[authSheetStyles.sheetHost, { transform: [{ translateY: sheetY }] }]}
      >
        <GlassCard
          glow
          padding={0}
          style={{ ...authSheetStyles.sheetCard, backgroundColor: AUTH_SHEET_BG }}
        >
          <View style={authSheetStyles.sheetHandleHit}>
            <View style={[authSheetStyles.sheetHandle, { backgroundColor: theme.mutedForeground }]} />
          </View>

          <View style={authSheetStyles.sheetHeader}>
            <Animated.View
              style={{
                opacity: brandReveal,
                transform: [{ scale: brandScale }],
              }}
            >
              <View style={authSheetStyles.sheetBrand}>
                <AuthBrandHeader subtitle="시작하기 전에" compact />
              </View>
            </Animated.View>
          </View>

          <ScrollView
            style={authSheetStyles.sheetScroll}
            contentContainerStyle={[
              authSheetStyles.sheetScrollContent,
              { paddingBottom: Math.max(insets.bottom, 16) + spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                authSheetStyles.sectionPanel,
                {
                  borderColor: theme.cardBorder,
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
                위치 권한 부여
              </Text>
              <Text style={[styles.sectionBody, { color: theme.mutedForeground }]}>
                현재 계신 지역의 Star-Index를 측정하려면 위치 권한이 필요해요.{'\n'}
                GPS로 지금 이곳의 밤하늘 점수를 바로 확인할 수 있어요.
              </Text>

              {locationStatusHint ? (
                <Text
                  style={[
                    styles.statusHint,
                    {
                      color:
                        permissionStatus === Location.PermissionStatus.GRANTED
                          ? theme.primaryGlow
                          : theme.mutedForeground,
                    },
                  ]}
                >
                  {locationStatusHint}
                </Text>
              ) : null}

              {permissionStatus !== Location.PermissionStatus.GRANTED ? (
                <AuthSubmitButton
                  label="위치 권한 허용"
                  loading={locationBusy}
                  onPress={() => void requestLocation()}
                />
              ) : null}

              {permissionStatus === Location.PermissionStatus.DENIED ? (
                <Pressable onPress={openLocationSettings} hitSlop={8}>
                  <Text style={[styles.settingsLink, { color: theme.primaryGlow }]}>
                    시스템 설정에서 허용하기
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View
              style={[
                authSheetStyles.sectionPanel,
                {
                  borderColor: theme.cardBorder,
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
                알림 안내
              </Text>
              <Text style={[styles.sectionBody, { color: theme.mutedForeground }]}>
                StarChaser 알림은 아래 두 가지예요.{'\n'}
                종류·기준 점수(80·85·90·95)는 마이페이지(ME) 알림 설정에서 바꿀 수 있어요.
              </Text>

              <View style={styles.notifList}>
                {NOTIF_INFO_ITEMS.map((item) => (
                  <View key={item.title} style={styles.notifRow}>
                    <View
                      style={[
                        styles.notifIcon,
                        {
                          backgroundColor: theme.primaryGlowMuted,
                          borderColor: theme.primaryGlowBorder,
                        },
                      ]}
                    >
                      <Text style={styles.notifIconText}>{item.icon}</Text>
                    </View>
                    <View style={styles.notifText}>
                      <Text style={[styles.notifTitle, { color: theme.foreground }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.notifDesc, { color: theme.mutedForeground }]}>
                        {item.desc}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={[styles.notifFootnote, { color: theme.mutedForeground }]}>
                받은 알림은 메인(MAIN) 화면 우측 상단{' '}
                <Text style={{ color: theme.foreground }}>종 아이콘</Text>
                에서 확인할 수 있어요.
              </Text>
            </View>

            <AuthSubmitButton
              label="시작하기"
              loading={busy}
              onPress={() => void finishOnboarding()}
            />
          </ScrollView>
        </GlassCard>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.h3,
    letterSpacing: -0.2,
  },
  sectionBody: {
    ...typography.bodySm,
    lineHeight: 20,
  },
  statusHint: {
    fontSize: 13,
    lineHeight: 19,
  },
  settingsLink: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: -4,
  },
  notifList: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  notifIconText: {
    fontSize: 16,
  },
  notifText: {
    flex: 1,
    minWidth: 0,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  notifDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  notifFootnote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
