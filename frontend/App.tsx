/**
 * StarChaser — App.tsx
 * 메인: 천구 + TOP5 · 지도 마커: Star-Index 상세 시트
 */

import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  StyleSheet,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeProvider, useTheme } from './themes/ThemeContext';
import { AuthProvider, useAuth } from './contexts/auth-context';
import { BottomTab, Button, Screen, type StatefulCardError } from './components/ui';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { KakaoMapWebView } from './components/map/KakaoMapWebView';
import { MapSpotDetailModal } from './components/map/MapSpotDetailModal';
import { ProfileTabScreen } from './components/profile/ProfileTabScreen';
import { RecordsTabScreen } from './components/records/RecordsTabScreen';
import { SkyTabScreen } from './components/sky/SkyTabScreen';
import { AuthScreen } from './components/auth/auth-screen';
import { getDefaultSpotId } from './lib/config';
import {
  ApiRequestError,
  fetchWeeklyTop5,
  fetchStarIndex,
  SessionExpiredError,
} from './lib/api-client';
import type { StarIndexResponseDto, WeeklyTop5ItemDto } from './lib/types/api';

function starIndexErrorFromApi(e: ApiRequestError): StatefulCardError {
  if (e.status === 503) {
    return {
      cardDescription: '데이터 준비 중',
      isTransient: true,
      lines: [
        e.message,
        '서버 API 키(KMA·에어코리아·KASI)와 네트워크를 확인하세요.',
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
  const [activeTab, setActiveTab] = useState<string>('sky');
  /** MAP 탭을 한 번 연 뒤에는 WebView를 유지해 줌/센터·마커 상태가 탭 전환 후에도 유지되게 함 */
  const [mapLayerMounted, setMapLayerMounted] = useState(false);

  const [deviceLat, setDeviceLat] = useState<number | null>(null);
  const [deviceLng, setDeviceLng] = useState<number | null>(null);
  const [foregroundLocationStatus, setForegroundLocationStatus] =
    useState<Location.PermissionResponse['status'] | null>(null);

  // Map: 마커 클릭 → 상세 시트
  const [mapSpotId, setMapSpotId] = useState<string | null>(null);
  const [mapDetailOpen, setMapDetailOpen] = useState(false);
  /** MAP 탭 — NASA VIIRS 타일 오버레이 ON/OFF */
  const [mapViirsEnabled, setMapViirsEnabled] = useState(false);
  const [mapSiLoading, setMapSiLoading] = useState(false);
  const [mapSiError, setMapSiError] = useState<StatefulCardError | null>(null);
  const [mapSiData, setMapSiData] = useState<StarIndexResponseDto | null>(null);

  const defaultSpotId = getDefaultSpotId();
  /** TOP5·관측 로그 기준 명소 — 지도 선택과 별개로 유지 */
  const [focusSpotId, setFocusSpotId] = useState<string | null>(() => getDefaultSpotId() ?? null);

  useEffect(() => {
    setFocusSpotId((prev) => (prev == null && defaultSpotId ? defaultSpotId : prev));
  }, [defaultSpotId]);

  useEffect(() => {
    if (activeTab === 'map') setMapLayerMounted(true);
  }, [activeTab]);

  useEffect(() => {
    void (async () => {
      const existing = await Location.getForegroundPermissionsAsync();
      setForegroundLocationStatus(existing.status);
      if (existing.status === Location.PermissionStatus.UNDETERMINED) {
        const asked = await Location.requestForegroundPermissionsAsync();
        setForegroundLocationStatus(asked.status);
      }
    })();
  }, []);

  useEffect(() => {
    if (foregroundLocationStatus !== Location.PermissionStatus.GRANTED) {
      return;
    }
    let sub: Location.LocationSubscription | undefined;
    let alive = true;
    void (async () => {
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 25,
          timeInterval: 8000,
        },
        (loc) => {
          if (!alive) return;
          setDeviceLat(loc.coords.latitude);
          setDeviceLng(loc.coords.longitude);
        },
      );
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [foregroundLocationStatus]);

  const requestLocationPermission = useCallback(async () => {
    const r = await Location.requestForegroundPermissionsAsync();
    setForegroundLocationStatus(r.status);
    if (r.status === Location.PermissionStatus.GRANTED) {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setDeviceLat(pos.coords.latitude);
        setDeviceLng(pos.coords.longitude);
      } catch {
        /* 단말·서비스 일시 오류는 watch에서 보정 */
      }
    }
  }, []);

  const [top5Loading, setTop5Loading] = useState(false);
  const [top5Error, setTop5Error] = useState<string | null>(null);
  const [top5Items, setTop5Items] = useState<WeeklyTop5ItemDto[] | null>(null);

  /** 가상 밤하늘 — UI는 한국 시각 기준, API `at`는 UTC ISO */
  const [skyObserveAtIso, setSkyObserveAtIso] = useState(() =>
    new Date().toISOString(),
  );

  const shiftSkyObserveHours = useCallback((deltaHours: number) => {
    setSkyObserveAtIso((prev) => {
      const d = new Date(prev);
      d.setTime(d.getTime() + deltaHours * 3600 * 1000);
      return d.toISOString();
    });
  }, []);

  const resetSkyObserveNow = useCallback(() => {
    setSkyObserveAtIso(new Date().toISOString());
  }, []);

  useEffect(() => {
    if (activeTab !== 'sky') return;
    let cancelled = false;
    (async () => {
      setTop5Loading(true);
      setTop5Error(null);
      try {
        const items = await fetchWeeklyTop5();
        if (!cancelled) setTop5Items(items);
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          if (!cancelled) setTop5Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
          await onSessionInvalidated();
          return;
        }
        if (e instanceof ApiRequestError) {
          if (!cancelled) setTop5Error(e.message);
        } else {
          if (!cancelled) setTop5Error('주간 TOP5를 불러오지 못했습니다.');
        }
        if (!cancelled) setTop5Items(null);
      } finally {
        if (!cancelled) setTop5Loading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, onSessionInvalidated]);

  const kakaoJavascriptKey = process.env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  const kakaoMapPageUrl = process.env.EXPO_PUBLIC_KAKAO_MAP_PAGE_URL;

  const loadMapSpotStarIndex = useCallback(
    (spotId: string) => {
      setMapSiLoading(true);
      setMapSiError(null);
      setMapSiData(null);
      void (async () => {
        try {
          const data = await fetchStarIndex(spotId);
          setMapSiData(data);
        } catch (e) {
          if (e instanceof SessionExpiredError) {
            await onSessionInvalidated();
            return;
          }
          if (e instanceof ApiRequestError) {
            setMapSiError(starIndexErrorFromApi(e));
          } else {
            setMapSiError({
              cardDescription: '오류',
              isTransient: false,
              lines: ['Star-Index를 불러오지 못했습니다.'],
            });
          }
        } finally {
          setMapSiLoading(false);
        }
      })();
    },
    [onSessionInvalidated],
  );

  return (
    <Screen>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {/* 지도는 이 영역 안에서만 absoluteFill → 하단 탭과 레이아웃 겹침 없음 */}
        <View style={styles.mainTabContent}>
        {mapLayerMounted ? (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              activeTab === 'map' ? styles.mapTabLayerVisible : styles.mapTabLayerHidden,
            ]}
            pointerEvents={activeTab === 'map' ? 'auto' : 'none'}
            collapsable={false}
          >
            <View style={{ flex: 1 }}>
            <KakaoMapWebView
              mapPageUrl={kakaoMapPageUrl}
              kakaoJavascriptKey={kakaoJavascriptKey}
              spotListMode="all"
              viirsLayerEnabled={mapViirsEnabled}
              onSessionExpired={onSessionInvalidated}
              onMessage={(msg) => {
                if (__DEV__) {
                  if (msg.type === 'VIIRS_LAYER_READY' || msg.type === 'VIIRS_LAYER_ERROR') {
                    // eslint-disable-next-line no-console
                    console.log('[VIIRS_LAYER]', msg);
                  }
                  // eslint-disable-next-line no-console
                  console.log('[KakaoMap]', msg);
                }
                if (msg.type === 'MARKER_CLICK') {
                  const spotId = msg.data.spotId;
                  setFocusSpotId(spotId);
                  setMapSpotId(spotId);
                  setMapDetailOpen(true);
                  loadMapSpotStarIndex(spotId);
                }
              }}
            />

            <View style={styles.mapViirsChip} pointerEvents="box-none">
              {mapViirsEnabled ? (
                <Button
                  label="광공해 끄기"
                  variant="primary"
                  size="sm"
                  onPress={() => setMapViirsEnabled(false)}
                />
              ) : (
                <Pressable
                  onPress={() => setMapViirsEnabled(true)}
                  style={({ pressed }) => ({
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    borderWidth: 1,
                    borderRadius: theme.radius,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    opacity: pressed ? 0.82 : 1,
                    alignSelf: 'flex-start',
                  })}
                >
                  <Text
                    style={{
                      color: theme.foreground,
                      fontSize: 12,
                      fontWeight: '500',
                      letterSpacing: 0.1,
                    }}
                  >
                    광공해 켜기
                  </Text>
                </Pressable>
              )}
            </View>
            </View>
          </View>
        ) : null}
        {activeTab !== 'map' ? (
          activeTab === 'sky' ? (
            <SkyTabScreen
              observerLat={deviceLat}
              observerLng={deviceLng}
              observerSpotId={focusSpotId}
              observeAtIso={skyObserveAtIso}
              onShiftHours={shiftSkyObserveHours}
              onObserveNow={resetSkyObserveNow}
              onSessionInvalidated={onSessionInvalidated}
              skyUsesGps={deviceLat != null && deviceLng != null}
              locationPermissionStatus={foregroundLocationStatus}
              onRequestLocationPermission={requestLocationPermission}
              top5Loading={top5Loading}
              top5Error={top5Error}
              top5Items={top5Items}
              selectedSpotId={focusSpotId}
              onSelectTop5Spot={(id: string) => setFocusSpotId(id)}
            />
          ) : activeTab === 'records' ? (
            <RecordsTabScreen
              activeSpotId={focusSpotId}
              observerLat={deviceLat}
              observerLng={deviceLng}
              onSessionInvalidated={onSessionInvalidated}
            />
          ) : activeTab === 'profile' ? (
            <ProfileTabScreen
              email={user?.email ?? null}
              onLogout={() => void logout()}
              isRedMode={isRedMode}
              onToggleRedMode={toggleRed}
              onSessionInvalidated={onSessionInvalidated}
              onDevResetOnboarding={__DEV__ ? onResetOnboarding : undefined}
            />
          ) : null
        ) : null}
        </View>

        <MapSpotDetailModal
          visible={mapDetailOpen}
          onClose={() => {
            setMapDetailOpen(false);
            setMapSpotId(null);
            setMapSiData(null);
            setMapSiError(null);
          }}
          spotId={mapSpotId}
          loading={mapSiLoading}
          error={mapSiError}
          data={mapSiData}
          onRetry={() => mapSpotId && loadMapSpotStarIndex(mapSpotId)}
          onSessionInvalidated={onSessionInvalidated}
          starIndexErrorFromApi={starIndexErrorFromApi}
        />

        <View style={styles.tabWrap}>
          <BottomTab
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'sky', label: 'Sky', icon: '🌌', redIcon: '◉' },
              { key: 'map', label: 'Map', icon: '🗺', redIcon: '◈', hasDot: true },
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
  const { isHydrated, isAuthenticated, user } = useAuth();
  const [route, setRoute] = useState<'boot' | 'onboarding' | 'ready'>('boot');

  const resetOnboarding = useCallback(async () => {
    const userId = user?.id;
    const keys: string[] = [
      // legacy (앱 전체 1회)
      'starChaser:onboardingCompleted',
      'starChaser:onboardingRegion',
      'starChaser:notificationPrefs',
      'starChaser:onboardInterests',
    ];
    if (userId) {
      // user-scoped (user별 1회)
      keys.push(
        `starChaser:onboardingCompleted:${userId}`,
        `starChaser:onboardingRegion:${userId}`,
        `starChaser:notificationPrefs:${userId}`,
        `starChaser:onboardInterests:${userId}`,
      );
    }
    await AsyncStorage.multiRemove(keys);
    setRoute('onboarding');
  }, [user?.id]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    // 인증 직후 user가 아직 세팅 전이면 잠깐 대기
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      try {
        const completedKey = `starChaser:onboardingCompleted:${user.id}`;
        const regionKey = `starChaser:onboardingRegion:${user.id}`;
        const notifKey = `starChaser:notificationPrefs:${user.id}`;
        const interestsKey = `starChaser:onboardInterests:${user.id}`;
        const legacyKeys = [
          'starChaser:onboardingCompleted',
          'starChaser:onboardingRegion',
          'starChaser:notificationPrefs',
          'starChaser:onboardInterests',
        ];

        // 유저별 키만 신뢰 (legacy는 새 계정에 잘못 적용될 수 있어 정리만 수행)
        const [completed, region, notif, interests] = await AsyncStorage.multiGet([
          completedKey,
          regionKey,
          notifKey,
          interestsKey,
        ]).then((rows) => rows.map(([, v]) => v));
        if (!mounted) return;

        // 안전장치: 과거 마이그레이션/테스트로 completedKey만 잘못 남은 경우 → 온보딩으로 복구
        if (completed === 'true' && (region || notif || interests)) {
          setRoute('ready');
          return;
        }
        if (completed === 'true' && !region && !notif && !interests) {
          void AsyncStorage.removeItem(completedKey);
        }
        // legacy 키가 남아있으면 1회 정리
        void AsyncStorage.multiRemove(legacyKeys);
        setRoute('onboarding');
      } catch {
        if (!mounted) return;
        setRoute('onboarding');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isHydrated, isAuthenticated, user?.id]);

  if (!isHydrated) return <AppLoading />;
  if (!isAuthenticated) return <AuthScreen />;
  if (route === 'boot') return <AppLoading />;
  if (route === 'onboarding') {
    // userId가 없으면 (드물게) 로딩 유지
    if (!user?.id) return <AppLoading />;
    return <OnboardingFlow userId={user.id} onDone={() => setRoute('ready')} />;
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
  mainTabContent: {
    flex: 1,
  },
  mapTabLayerVisible: {
    opacity: 1,
  },
  mapTabLayerHidden: {
    opacity: 0,
  },
  mapViirsChip: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
  tabWrap: {
    paddingTop: 4,
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
