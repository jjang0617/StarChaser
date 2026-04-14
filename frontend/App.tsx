/**
 * StarChaser — App.tsx
 * AuthProvider → 온보딩 → 메인. Star-Index는 GET /star-index?spotId= 연동.
 */

import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeProvider, useTheme } from './themes/ThemeContext';
import { AuthProvider, useAuth } from './contexts/auth-context';
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
import { AuthScreen } from './components/auth/auth-screen';
import { getDefaultSpotId } from './lib/config';
import {
  ApiRequestError,
  fetchStarIndex,
  SessionExpiredError,
} from './lib/api-client';
import { starIndexResponseToCardModel } from './lib/star-index-display';
import type { StarIndexResponseDto } from './lib/types/api';

/** Star-Index 카드에 표시할 오류(503 캐시 부족 vs 일반) */
type StarIndexUiError = {
  cardDescription: string;
  lines: string[];
  /** true면 안내 톤(빨간 에러색 대신 muted) */
  isTransient: boolean;
};

function starIndexErrorFromApi(e: ApiRequestError): StarIndexUiError {
  if (e.status === 503) {
    return {
      cardDescription: '캐시 준비 중',
      isTransient: true,
      lines: [
        '이 명소에 맞는 기상·미세먼지·달 캐시가 아직 없거나 갱신 중일 수 있어요. 서버는 실패해도 기존 캐시를 유지하니, 잠시 뒤 다시 시도해 주세요.',
        '개발 환경: Swagger → cron → POST /cron/run-once 로 수집을 한 번 돌린 뒤 새로고침해 보세요.',
      ],
    };
  }
  return {
    cardDescription: '오류',
    isTransient: false,
    lines: [e.message],
  };
}

function AppContent({ onResetOnboarding }: { onResetOnboarding: () => void }) {
  const { theme, toggleRed, isRedMode } = useTheme();
  const { user, logout, onSessionInvalidated } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('home');
  const [location, setLocation] = useState<string>('');

  const defaultSpotId = getDefaultSpotId();
  const [siLoading, setSiLoading] = useState(false);
  const [siError, setSiError] = useState<StarIndexUiError | null>(null);
  const [siData, setSiData] = useState<StarIndexResponseDto | null>(null);
  const [siRefreshKey, setSiRefreshKey] = useState(0);

  useEffect(() => {
    if (!defaultSpotId) {
      setSiData(null);
      setSiError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setSiLoading(true);
      setSiError(null);
      try {
        const data = await fetchStarIndex(defaultSpotId);
        if (!cancelled) setSiData(data);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await onSessionInvalidated();
          return;
        }
        if (e instanceof ApiRequestError) {
          if (!cancelled) setSiError(starIndexErrorFromApi(e));
        } else if (!cancelled) {
          setSiError({
            cardDescription: '오류',
            isTransient: false,
            lines: ['Star-Index를 불러오지 못했습니다.'],
          });
        }
        if (!cancelled) setSiData(null);
      } finally {
        if (!cancelled) setSiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultSpotId, siRefreshKey, onSessionInvalidated]);

  const kakaoJavascriptKey = process.env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  const kakaoMapPageUrl = process.env.EXPO_PUBLIC_KAKAO_MAP_PAGE_URL;

  const starProps = siData ? starIndexResponseToCardModel(siData) : null;

  return (
    <Screen>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {activeTab === 'map' ? (
          <KakaoMapWebView
            mapPageUrl={kakaoMapPageUrl}
            kakaoJavascriptKey={kakaoJavascriptKey}
            onSessionExpired={onSessionInvalidated}
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
            <Text
              style={[
                styles.appTitle,
                { color: theme.foreground, fontFamily: 'SpaceMono-Regular' },
              ]}
            >
              StarChaser
            </Text>
            <View style={styles.headerRow}>
              <Text
                style={[
                  styles.appSub,
                  { color: theme.mutedForeground, fontFamily: 'SpaceMono-Regular' },
                ]}
              >
                {user?.email ?? ''}
              </Text>
              <Button
                label="로그아웃"
                variant="ghost"
                size="sm"
                onPress={() => void logout()}
              />
            </View>
            {__DEV__ && (
              <View style={styles.devRow}>
                <Button
                  label="DEV: 온보딩 다시보기"
                  variant="outline"
                  onPress={onResetOnboarding}
                />
                <Button
                  label="DEV: 로그아웃"
                  variant="ghost"
                  size="sm"
                  onPress={() => void logout()}
                />
              </View>
            )}

            <View style={styles.row}>
              <Badge label="Bortle 3" variant="gold" mono />
              <Badge label="▲ 757m" variant="steel" mono />
              <Badge label="주차" variant="muted" />
              <Badge label="Red Mode" variant="red" />
            </View>

            {/* Star-Index — GET /star-index?spotId= */}
            {!defaultSpotId ? (
              <Card
                title="Star-Index"
                description="EXPO_PUBLIC_DEFAULT_SPOT_ID에 spots.id(UUID)를 넣으면 서버에서 점수를 불러옵니다."
              >
                <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                  예: 시드 영월 별마로 천문대 UUID를 .env에 설정하세요.
                </Text>
              </Card>
            ) : siLoading ? (
              <Card title="Star-Index" description="불러오는 중…">
                <ActivityIndicator color={theme.starGold} />
              </Card>
            ) : siError ? (
              <Card title="Star-Index" description={siError.cardDescription}>
                {siError.lines.map((line, i) => (
                  <Text
                    key={i}
                    style={{
                      color: siError.isTransient
                        ? theme.mutedForeground
                        : theme.dimRedFg,
                      fontSize: 12,
                      marginBottom: i < siError.lines.length - 1 ? 8 : 0,
                    }}
                  >
                    {line}
                  </Text>
                ))}
                <Button
                  label="다시 시도"
                  variant="outline"
                  size="sm"
                  style={{ marginTop: 10 }}
                  onPress={() => setSiRefreshKey((k) => k + 1)}
                />
              </Card>
            ) : starProps ? (
              <View style={{ gap: 8 }}>
                <StarIndexCard
                  score={starProps.score}
                  cloudCover={starProps.cloudCover}
                  pm25Level={starProps.pm25Level}
                  moonAltitude={starProps.moonAltitude}
                  moonAltitudeKnown={starProps.moonAltitudeKnown}
                />
                <Button
                  label="Star-Index 새로고침"
                  variant="outline"
                  size="sm"
                  onPress={() => setSiRefreshKey((k) => k + 1)}
                />
              </View>
            ) : null}

            {siData ? (
              <SpotCard
                name={siData.name}
                region={`${siData.lat.toFixed(4)} · ${siData.lng.toFixed(4)}`}
                elevation={siData.elevationM}
                bortleClass={siData.bortleClass}
                starIndex={siData.score}
                hasParking={false}
                hasToilet={false}
              />
            ) : (
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
            )}

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

        <View style={styles.tabWrap}>
          <BottomTab
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'home', label: 'Home', icon: '⭐', redIcon: '★' },
              { key: 'map', label: 'Map', icon: '🗺', redIcon: '◈', hasDot: true },
              { key: 'sky', label: 'Sky', icon: '🌌', redIcon: '◉' },
              { key: 'records', label: 'Log', icon: '📋', redIcon: '≡' },
              { key: 'profile', label: 'Me', icon: '👤', redIcon: '○' },
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
        <Text
          style={[
            styles.loadingText,
            { color: theme.mutedForeground, fontFamily: 'SpaceMono-Regular' },
          ]}
        >
          로딩 중...
        </Text>
      </View>
    </Screen>
  );
}

/**
 * 인증 후 온보딩 여부만 분기 — 로그아웃 시 AuthScreen
 */
function AppGate() {
  const { isHydrated, isAuthenticated } = useAuth();
  const [route, setRoute] = useState<'boot' | 'onboarding' | 'ready'>('boot');

  const resetOnboarding = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem('starChaser:onboardingCompleted'),
      AsyncStorage.removeItem('starChaser:onboardingRegion'),
      AsyncStorage.removeItem('starChaser:notificationPrefs'),
      AsyncStorage.removeItem('starChaser:onboardInterests'),
    ]);
    setRoute('onboarding');
  }, []);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    let mounted = true;
    (async () => {
      try {
        const completed = await AsyncStorage.getItem('starChaser:onboardingCompleted');
        if (!mounted) return;
        setRoute(completed === 'true' ? 'ready' : 'onboarding');
      } catch {
        if (!mounted) return;
        setRoute('onboarding');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isHydrated, isAuthenticated]);

  if (!isHydrated) return <AppLoading />;
  if (!isAuthenticated) return <AuthScreen />;
  if (route === 'boot') return <AppLoading />;
  if (route === 'onboarding') {
    return <OnboardingFlow onDone={() => setRoute('ready')} />;
  }
  return <AppContent onResetOnboarding={resetOnboarding} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppGate />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: 12,
    paddingBottom: 20,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  appSub: {
    fontSize: 10,
    letterSpacing: 1,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
    gap: 8,
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
