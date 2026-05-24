/**
 * 온보딩: 알림 종류 선택 (Figma OnboardingScreen 레이아웃)
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { spacing, typography } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';
import { authorizedPutJson } from '../../lib/api-client';
import { notificationPrefsKey, onboardingCompletedKey } from '../../lib/auth-storage';
import { AppToggle } from '../ui/AppToggle';
import { GlassCard } from '../ui/GlassCard';
import { Screen } from '../ui/Screen';

type NotificationPrefs = {
  starIndex70: boolean;
  meteorEvents: boolean;
  weeklyTop3: boolean;
};

const NOTIF_ITEMS: Array<{
  key: keyof NotificationPrefs;
  icon: string;
  title: string;
  desc: string;
}> = [
  {
    key: 'starIndex70',
    icon: '★',
    title: '오늘 밤, 볼 만한 날만',
    desc: '별 보기 좋은 날(점수가 70 넘을 때)에만 살짝 알려줄게요.',
  },
  {
    key: 'meteorEvents',
    icon: '🔔',
    title: '하늘 이벤트 소식',
    desc: '유성우, 월식 같은 특별한 날 + ISS 지나갈 때도 알려드려요.',
  },
  {
    key: 'weeklyTop3',
    icon: '📍',
    title: '이번 주 가볼 만한 곳',
    desc: '매주 월요일 아침 7시, 이번 주 추천 명소 세 곳만 정리해서 보내요.',
  },
];

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
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    starIndex70: true,
    meteorEvents: true,
    weeklyTop3: true,
  });

  const finishOnboarding = useCallback(
    async (prefsOverride?: NotificationPrefs) => {
      setBusy(true);
      const prefs = prefsOverride ?? notifPrefs;
      try {
        await Promise.all([
          AsyncStorage.setItem(onboardingCompletedKey(userId), 'true'),
          AsyncStorage.setItem(
            notificationPrefsKey(userId),
            JSON.stringify(prefs),
          ),
        ]);

        try {
          const anyChannel =
            prefs.starIndex70 || prefs.meteorEvents || prefs.weeklyTop3;
          await authorizedPutJson('/notifications/preferences', {
            alertsEnabled: anyChannel,
            starIndexAlertEnabled: prefs.starIndex70,
            astronomyEventAlertEnabled: prefs.meteorEvents,
            top3AlertEnabled: prefs.weeklyTop3,
          });
        } catch (e) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[OnboardingFlow] 서버 알림 설정 동기화 실패(온보딩은 완료됨)', e);
          }
        }

        onDone();
      } finally {
        setBusy(false);
      }
    },
    [notifPrefs, onDone, userId],
  );

  const skipAllNotifications = useCallback(() => {
    void finishOnboarding({
      starIndex70: false,
      meteorEvents: false,
      weeklyTop3: false,
    });
  }, [finishOnboarding]);

  return (
    <Screen noPadding>
      <View
        style={[
          styles.flex,
          {
            paddingTop: Math.max(insets.top, 12) + spacing.lg,
            paddingBottom: Math.max(insets.bottom, 16) + spacing.md,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, typography.h1, { color: theme.foreground }]}>
            알림 설정
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            마이페이지(ME)에서 언제든 바꿀 수 있어요.
          </Text>
        </View>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {NOTIF_ITEMS.map((item) => {
            const enabled = notifPrefs[item.key];
            return (
              <GlassCard key={item.key} padding={16} style={styles.notifCard}>
                <View style={styles.notifRow}>
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: theme.primaryGlowMuted,
                        borderColor: theme.primaryGlowBorder,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 18, color: theme.primaryGlow }}>{item.icon}</Text>
                  </View>
                  <View style={styles.notifText}>
                    <Text style={[styles.notifTitle, { color: theme.foreground }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.notifDesc, { color: theme.mutedForeground }]}>
                      {item.desc}
                    </Text>
                  </View>
                  <AppToggle
                    value={enabled}
                    onValueChange={(v) =>
                      setNotifPrefs((prev) => ({ ...prev, [item.key]: v }))
                    }
                    disabled={busy}
                  />
                </View>
              </GlassCard>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={() => void finishOnboarding()}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: theme.primaryGlowMuted,
                borderColor: theme.primaryGlowBorder,
                opacity: busy ? 0.5 : pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={[styles.primaryBtnText, { color: theme.foreground }]}>
              {busy ? '저장 중…' : '시작하기'}
            </Text>
          </Pressable>
          <Pressable onPress={skipAllNotifications} disabled={busy} hitSlop={8}>
            <Text style={[styles.skipText, { color: theme.mutedForeground }]}>건너뛰기</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingHorizontal: spacing.xl },
  header: { marginBottom: spacing.lg },
  title: { marginBottom: spacing.sm },
  subtitle: { ...typography.bodySm, lineHeight: 20 },
  listScroll: { flex: 1 },
  listContent: { gap: spacing.md, paddingBottom: spacing.lg },
  notifCard: {},
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifText: { flex: 1, minWidth: 0 },
  notifTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  notifDesc: { fontSize: 13, lineHeight: 19 },
  actions: { gap: spacing.md, paddingTop: spacing.sm },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600' },
  skipText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: spacing.sm,
  },
});
