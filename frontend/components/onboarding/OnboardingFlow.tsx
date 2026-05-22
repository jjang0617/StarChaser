/**
 * 온보딩: 알림 종류 선택.
 * 완료 시 AsyncStorage + PUT /notifications/preferences → ME 탭과 서버 동기화.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Button, Card, Screen } from '../ui';
import { useTheme } from '../../themes/ThemeContext';
import { authorizedPutJson } from '../../lib/api-client';

type NotificationPrefs = {
  starIndex70: boolean;
  meteorEvents: boolean;
  weeklyTop3: boolean;
};

const KEY_COMPLETED_BASE = 'starChaser:onboardingCompleted';
const KEY_NOTIF_PREFS_BASE = 'starChaser:notificationPrefs';

function onboardingKey(base: string, userId: string) {
  return `${base}:${userId}`;
}

const NOTIF_ITEMS: Array<{
  key: keyof NotificationPrefs;
  title: string;
  desc: string;
}> = [
  {
    key: 'starIndex70',
    title: '오늘 밤, 볼 만한 날만',
    desc: '별 보기 좋은 날(점수가 70 넘을 때)에만 살짝 알려줄게요.',
  },
  {
    key: 'meteorEvents',
    title: '하늘 이벤트 소식',
    desc: '유성우, 월식 같은 특별한 날 + ISS 지나갈 때도 알려드려요.',
  },
  {
    key: 'weeklyTop3',
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
          AsyncStorage.setItem(onboardingKey(KEY_COMPLETED_BASE, userId), 'true'),
          AsyncStorage.setItem(
            onboardingKey(KEY_NOTIF_PREFS_BASE, userId),
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
    <Screen noPadding={false}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Text style={[styles.title, { color: theme.foreground }]}>알림 설정</Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            받고 싶은 소식만 골라 주세요. 마이페이지(ME)에서 언제든 바꿀 수 있어요.
          </Text>
        </View>

        <Card title="알림" description="받을 알림만 골라요">
          <View style={styles.cardInner}>
            <View style={styles.toggleList}>
              {NOTIF_ITEMS.map(item => {
                const enabled = notifPrefs[item.key];
                return (
                  <Pressable
                    key={item.key}
                    onPress={() =>
                      setNotifPrefs(prev => ({ ...prev, [item.key]: !prev[item.key] }))
                    }
                    style={({ pressed }) => [
                      styles.toggleRow,
                      {
                        borderColor: enabled ? theme.ring : theme.border,
                        backgroundColor: enabled ? theme.input : 'transparent',
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.toggleTitle, { color: theme.foreground }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.toggleDesc, { color: theme.mutedForeground }]}>
                        {item.desc}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.toggleMark,
                        {
                          borderColor: enabled ? theme.starGold : theme.border,
                          backgroundColor: enabled ? theme.starGold : 'transparent',
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.btnRow}>
              <View style={{ flex: 1 }}>
                <Button
                  label="건너뛰기"
                  variant="outline"
                  fullWidth
                  size="sm"
                  onPress={skipAllNotifications}
                  disabled={busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="시작하기"
                  fullWidth
                  size="sm"
                  onPress={() => void finishOnboarding()}
                  disabled={busy}
                  loading={busy}
                />
              </View>
            </View>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 14,
  },
  top: {
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardInner: {
    gap: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  toggleList: {
    gap: 10,
    marginTop: 6,
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  toggleMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
});
