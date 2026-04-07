/**
 * StarChaser — App.tsx
 * ThemeProvider로 전체 감싸기
 * 기존 App 구조 유지하면서 새 컴포넌트 적용
 */

import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeProvider, useTheme } from './themes/ThemeContext';
import {
  Badge,
  BottomTab,
  Button,
  Card,
  StarIndexCard,
  SpotCard,
  Input,
  Screen,
} from './components/ui';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { KakaoMapWebView } from './components/map/KakaoMapWebView';

// ── 실제 앱 내용 — ThemeProvider 안에서 useTheme() 사용 가능 ──
function AppContent({ onResetOnboarding }: { onResetOnboarding: () => void }) {
  const { theme, toggleRed, isRedMode } = useTheme();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [location, setLocation]   = useState<string>('');

  const kakaoJavascriptKey = process.env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  const kakaoMapPageUrl = process.env.EXPO_PUBLIC_KAKAO_MAP_PAGE_URL;

  return (
    <Screen>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {activeTab === 'map' ? (
          <KakaoMapWebView
            mapPageUrl={kakaoMapPageUrl}
            kakaoJavascriptKey={kakaoJavascriptKey}
            onMessage={(msg) => {
              if (__DEV__) {
                // eslint-disable-next-line no-console
                console.log('[KakaoMap]', msg);
              }
            }}
          />
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 헤더 */}
            <Text style={[styles.appTitle, { color: theme.foreground, fontFamily: 'SpaceMono-Regular' }]}>
              StarChaser
            </Text>
            <Text style={[styles.appSub, { color: theme.mutedForeground, fontFamily: 'SpaceMono-Regular' }]}>
              Anti-AI Component v2.0
            </Text>
            {__DEV__ && (
              <View style={styles.devRow}>
                <Button
                  label="DEV: 온보딩 다시보기"
                  variant="outline"
                  onPress={onResetOnboarding}
                />
              </View>
            )}

            {/* Badge 샘플 */}
            <View style={styles.row}>
              <Badge label="Bortle 3" variant="gold" mono />
              <Badge label="▲ 757m" variant="steel" mono />
              <Badge label="주차" variant="muted" />
              <Badge label="Red Mode" variant="red" />
            </View>

            {/* Star-Index 카드 */}
            <StarIndexCard
              score={78}
              cloudCover={15}
              pm25Level="보통"
              moonAltitude={12}
            />

            {/* 명소 카드 */}
            <SpotCard
              name="화왕산 억새평원"
              region="창녕군"
              elevation={757}
              bortleClass={3}
              starIndex={78}
              hasParking
              hasToilet
              distanceKm={23}
            />

            {/* 기본 Card */}
            <Card title="오늘의 관측 조건" description="기상/달/광공해 데이터 기반 실시간 계산">
              <View style={styles.cardInner}>
                <Input
                  label="관측 위치"
                  placeholder="강원 영월 별마로천문대"
                  value={location}
                  onChangeText={setLocation}
                  monoLabel
                />
                <Button label="관측 시작하기" fullWidth />
                <Button label="관측지 둘러보기" variant="outline" fullWidth />
                <Button
                  label={isRedMode ? '야간 모드 해제' : '🔴 Night Vision ON'}
                  variant="red"
                  fullWidth
                  onPress={toggleRed}
                />
              </View>
            </Card>
          </ScrollView>
        )}

        {/* BottomTab */}
        <View style={styles.tabWrap}>
          <BottomTab
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'home',    label: 'Home',   icon: '⭐', redIcon: '★' },
              { key: 'map',     label: 'Map',    icon: '🗺',  redIcon: '◈', hasDot: true },
              { key: 'sky',     label: 'Sky',    icon: '🌌', redIcon: '◉' },
              { key: 'records', label: 'Log',    icon: '📋', redIcon: '≡' },
              { key: 'profile', label: 'Me',     icon: '👤', redIcon: '○' },
            ]}
          />
        </View>
      </View>
    </Screen>
  );
}

function AppLoading() {
  const { theme } = useTheme();
  return (
    <Screen>
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={theme.starGold} />
        <Text style={[styles.loadingText, { color: theme.mutedForeground, fontFamily: 'SpaceMono-Regular' }]}>
          로딩 중...
        </Text>
      </View>
    </Screen>
  );
}

// ── 루트: ThemeProvider로 전체 감싸기 ──
export default function App() {
  const [status, setStatus] = useState<'loading' | 'onboarding' | 'ready'>('loading');

  const resetOnboarding = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem('starChaser:onboardingCompleted'),
      AsyncStorage.removeItem('starChaser:onboardingRegion'),
      AsyncStorage.removeItem('starChaser:notificationPrefs'),
      AsyncStorage.removeItem('starChaser:onboardInterests'),
    ]);
    setStatus('onboarding');
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const completed = await AsyncStorage.getItem('starChaser:onboardingCompleted');
        if (!mounted) return;
        setStatus(completed === 'true' ? 'ready' : 'onboarding');
      } catch {
        if (!mounted) return;
        setStatus('onboarding');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {status === 'loading' ? (
          <AppLoading />
        ) : status === 'onboarding' ? (
          <OnboardingFlow onDone={() => setStatus('ready')} />
        ) : (
          <AppContent onResetOnboarding={resetOnboarding} />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap:         12,
    paddingBottom: 20,
  },
  appTitle: {
    fontSize:      22,
    fontWeight:    '700',
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize:      10,
    letterSpacing:  1,
  },
  row: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:            6,
  },
  cardInner: {
    gap: 8,
  },
  tabWrap: {
    paddingTop: 4,
  },
  devRow: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 40,
  },
  loadingText: {
    fontSize: 12,
    letterSpacing: 0.4,
  },
});
