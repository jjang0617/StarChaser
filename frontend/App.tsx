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
  StatefulCard,
  Input,
  Screen,
  type StatefulCardError,
} from './components/ui';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { KakaoMapWebView } from './components/map/KakaoMapWebView';
import { ProfileTabScreen } from './components/profile/ProfileTabScreen';
import { RecordsTabScreen } from './components/records/RecordsTabScreen';
import { SkyTabScreen } from './components/sky/SkyTabScreen';
import { AuthScreen } from './components/auth/auth-screen';
import { getDefaultSpotId } from './lib/config';
import {
  ApiRequestError,
  type CorrectionAggregateDto,
  fetchCorrectionAggregate,
  fetchStarIndex,
  SessionExpiredError,
  submitStarIndexCorrection,
} from './lib/api-client';
import { starIndexResponseToCardModel } from './lib/star-index-display';
import type { StarIndexResponseDto } from './lib/types/api';

function starIndexErrorFromApi(e: ApiRequestError): StatefulCardError {
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

  // Map: 마커 클릭 → 해당 spotId의 Star-Index 오버레이
  const [mapSpotId, setMapSpotId] = useState<string | null>(null);
  const [mapSiLoading, setMapSiLoading] = useState(false);
  const [mapSiError, setMapSiError] = useState<StatefulCardError | null>(null);
  const [mapSiData, setMapSiData] = useState<StarIndexResponseDto | null>(null);

  const defaultSpotId = getDefaultSpotId();
  /** 지도 마커 또는 .env 기본 명소 — 홈·보정·관측 Log가 같은 UUID를 사용 */
  const [focusSpotId, setFocusSpotId] = useState<string | null>(() => getDefaultSpotId() ?? null);

  useEffect(() => {
    setFocusSpotId((prev) => (prev == null && defaultSpotId ? defaultSpotId : prev));
  }, [defaultSpotId]);

  const [siLoading, setSiLoading] = useState(false);
  const [siError, setSiError] = useState<StatefulCardError | null>(null);
  const [siData, setSiData] = useState<StarIndexResponseDto | null>(null);
  const [siRefreshKey, setSiRefreshKey] = useState(0);

  const [corrAgg, setCorrAgg] = useState<CorrectionAggregateDto | null>(null);
  const [perceivedQuality, setPerceivedQuality] = useState(75);
  const [corrBusy, setCorrBusy] = useState(false);
  const [corrMsg, setCorrMsg] = useState<string | null>(null);

  /** 가상 밤하늘 — 관측 시각(UTC) 스크럽용 */
  const [skyObserveAtIso, setSkyObserveAtIso] = useState(() =>
    new Date().toISOString(),
  );

  const shiftSkyObserveHours = useCallback((deltaHours: number) => {
    setSkyObserveAtIso((prev) => {
      const d = new Date(prev);
      d.setUTCHours(d.getUTCHours() + deltaHours);
      return d.toISOString();
    });
  }, []);

  const resetSkyObserveNowUtc = useCallback(() => {
    setSkyObserveAtIso(new Date().toISOString());
  }, []);

  useEffect(() => {
    if (!focusSpotId) {
      setSiData(null);
      setSiError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setSiLoading(true);
      setSiError(null);
      try {
        const data = await fetchStarIndex(focusSpotId);
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
  }, [focusSpotId, siRefreshKey, onSessionInvalidated]);

  useEffect(() => {
    if (activeTab !== 'home' || !focusSpotId) return;
    let cancelled = false;
    (async () => {
      try {
        const a = await fetchCorrectionAggregate(focusSpotId);
        if (!cancelled) setCorrAgg(a);
      } catch {
        if (!cancelled) setCorrAgg(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, focusSpotId, siRefreshKey]);

  const kakaoJavascriptKey = process.env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  const kakaoMapPageUrl = process.env.EXPO_PUBLIC_KAKAO_MAP_PAGE_URL;

  const starProps = siData ? starIndexResponseToCardModel(siData) : null;
  const mapStarProps = mapSiData ? starIndexResponseToCardModel(mapSiData) : null;

  return (
    <Screen>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {activeTab === 'map' ? (
          <View style={{ flex: 1 }}>
            <KakaoMapWebView
              mapPageUrl={kakaoMapPageUrl}
              kakaoJavascriptKey={kakaoJavascriptKey}
              spotListMode="all"
              onSessionExpired={onSessionInvalidated}
              onMessage={(msg) => {
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.log('[KakaoMap]', msg);
                }
                if (msg.type === 'MARKER_CLICK') {
                  const spotId = msg.data.spotId;
                  setFocusSpotId(spotId);
                  setMapSpotId(spotId);
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
                }
              }}
            />

            {(mapSiLoading || mapSiError || mapStarProps) && (
              <View style={styles.mapOverlay}>
                <StatefulCard
                  title="Star-Index"
                  description={mapSiData?.name}
                  loading={mapSiLoading}
                  error={mapSiError}
                  onRetry={
                    mapSpotId
                      ? () => {
                          setMapSiLoading(true);
                          setMapSiError(null);
                          setMapSiData(null);
                          void (async () => {
                            try {
                              const data = await fetchStarIndex(mapSpotId);
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
                        }
                      : undefined
                  }
                  retryLabel="새로고침"
                  footer={
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {mapSpotId ? (
                        <Button
                          label="홈·보정 기준"
                          variant="secondary"
                          size="sm"
                          onPress={() => {
                            setFocusSpotId(mapSpotId);
                            setActiveTab('home');
                          }}
                        />
                      ) : null}
                      {mapSpotId && (
                        <Button
                          label="새로고침"
                          variant="outline"
                          size="sm"
                          disabled={mapSiLoading}
                          onPress={() => {
                            setMapSiLoading(true);
                            setMapSiError(null);
                            setMapSiData(null);
                            void (async () => {
                              try {
                                const data = await fetchStarIndex(mapSpotId);
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
                          }}
                        />
                      )}
                      <Button
                        label="닫기"
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          setMapSpotId(null);
                          setMapSiLoading(false);
                          setMapSiError(null);
                          setMapSiData(null);
                        }}
                      />
                    </View>
                  }
                >
                  {mapStarProps ? (
                    <StarIndexCard
                      bare
                      score={mapStarProps.score}
                      cloudCover={mapStarProps.cloudCover}
                      pm25Level={mapStarProps.pm25Level}
                      moonAltitude={mapStarProps.moonAltitude}
                      moonAltitudeKnown={mapStarProps.moonAltitudeKnown}
                    />
                  ) : null}
                </StatefulCard>
              </View>
            )}
          </View>
        ) : activeTab === 'sky' ? (
          <SkyTabScreen
            observerLat={siData?.lat ?? null}
            observerLng={siData?.lng ?? null}
            observeAtIso={skyObserveAtIso}
            onShiftHours={shiftSkyObserveHours}
            onNowUtc={resetSkyObserveNowUtc}
            onSessionInvalidated={onSessionInvalidated}
          />
        ) : activeTab === 'records' ? (
          <RecordsTabScreen
            activeSpotId={focusSpotId}
            onSessionInvalidated={onSessionInvalidated}
          />
        ) : activeTab === 'profile' ? (
          <ProfileTabScreen
            email={user?.email ?? null}
            onLogout={() => void logout()}
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
              </View>
            )}

            <View style={styles.row}>
              <Badge label="Bortle 3" variant="gold" mono />
              <Badge label="▲ 757m" variant="steel" mono />
              <Badge label="주차" variant="muted" />
              <Badge label="Red Mode" variant="red" />
            </View>

            {focusSpotId ? (
              <Text
                style={{
                  color: theme.mutedForeground,
                  fontSize: 11,
                  marginBottom: 8,
                  fontFamily: 'SpaceMono-Regular',
                }}
                numberOfLines={2}
              >
                기준 명소 ID: {focusSpotId}
                {defaultSpotId && focusSpotId !== defaultSpotId
                  ? ' (지도에서 선택)'
                  : ''}
              </Text>
            ) : null}

            {defaultSpotId && focusSpotId && focusSpotId !== defaultSpotId ? (
              <View style={{ marginBottom: 10 }}>
                <Button
                  label="기본 명소로 되돌리기"
                  variant="outline"
                  size="sm"
                  onPress={() => setFocusSpotId(defaultSpotId)}
                />
              </View>
            ) : null}

            {/* Star-Index — GET /star-index?spotId= */}
            {!focusSpotId ? (
              <Card
                title="Star-Index"
                description="명소를 선택해야 점수를 불러옵니다."
              >
                <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                  지도에서 마커를 누르거나, EXPO_PUBLIC_DEFAULT_SPOT_ID에 spots.id(UUID)를
                  설정하세요.
                </Text>
              </Card>
            ) : (
              <StatefulCard
                title="Star-Index"
                loading={siLoading}
                error={siError}
                onRetry={() => setSiRefreshKey((k) => k + 1)}
                footer={
                  starProps && !siLoading && !siError ? (
                    <Button
                      label="Star-Index 새로고침"
                      variant="outline"
                      size="sm"
                      onPress={() => setSiRefreshKey((k) => k + 1)}
                    />
                  ) : null
                }
              >
                {starProps ? (
                  <StarIndexCard
                    bare
                    score={starProps.score}
                    cloudCover={starProps.cloudCover}
                    pm25Level={starProps.pm25Level}
                    moonAltitude={starProps.moonAltitude}
                    moonAltitudeKnown={starProps.moonAltitudeKnown}
                  />
                ) : null}
              </StatefulCard>
            )}

            {focusSpotId ? (
              <StatefulCard
                title="명소"
                loading={siLoading}
                error={siError}
                onRetry={() => setSiRefreshKey((k) => k + 1)}
              >
                {siData ? (
                  <SpotCard
                    bare
                    name={siData.name}
                    region={`${siData.lat.toFixed(4)} · ${siData.lng.toFixed(4)}`}
                    elevation={siData.elevationM}
                    bortleClass={siData.bortleClass}
                    starIndex={siData.score}
                    hasParking={false}
                    hasToilet={false}
                  />
                ) : null}
              </StatefulCard>
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

            {focusSpotId ? (
              <Card
                title="Star-Index 보정 제보"
                description="현장 가시도(0~100) 제보가 집계되어 correction_score에 반영됩니다."
              >
                {corrAgg ? (
                  <Text
                    style={{
                      color: theme.mutedForeground,
                      fontSize: 12,
                      marginBottom: 8,
                    }}
                  >
                    제보 {corrAgg.submissionCount}건 · 집계 correction_score 약{' '}
                    {corrAgg.aggregatedCorrectionScore}
                  </Text>
                ) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginVertical: 8,
                  }}
                >
                  <Button
                    label="−"
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      setPerceivedQuality((v) => Math.max(0, v - 5))
                    }
                  />
                  <Text
                    style={{
                      color: theme.foreground,
                      minWidth: 40,
                      textAlign: 'center',
                      fontFamily: 'SpaceMono-Regular',
                    }}
                  >
                    {perceivedQuality}
                  </Text>
                  <Button
                    label="+"
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      setPerceivedQuality((v) => Math.min(100, v + 5))
                    }
                  />
                </View>
                <Button
                  label="제보 보내기"
                  fullWidth
                  loading={corrBusy}
                  disabled={corrBusy}
                  onPress={() => {
                    if (!focusSpotId) return;
                    void (async () => {
                      setCorrBusy(true);
                      setCorrMsg(null);
                      try {
                        await submitStarIndexCorrection({
                          spotId: focusSpotId,
                          perceivedQuality,
                        });
                        setCorrMsg('반영되었습니다. Star-Index를 갱신합니다.');
                        setSiRefreshKey((k) => k + 1);
                      } catch (e) {
                        if (e instanceof SessionExpiredError) {
                          await onSessionInvalidated();
                          return;
                        }
                        if (e instanceof ApiRequestError) {
                          setCorrMsg(e.message);
                        } else {
                          setCorrMsg('제보에 실패했습니다.');
                        }
                      } finally {
                        setCorrBusy(false);
                      }
                    })();
                  }}
                />
                {corrMsg ? (
                  <Text
                    style={{
                      color: theme.mutedForeground,
                      fontSize: 12,
                      marginTop: 8,
                    }}
                  >
                    {corrMsg}
                  </Text>
                ) : null}
              </Card>
            ) : null}

            <Card title="오늘의 관측 조건" description="기상/달/광공해 데이터 기반 실시간 계산">
              <View style={styles.cardInner}>
                <Input
                  label="관측 위치"
                  placeholder="강원 영월 별마로천문대"
                  value={location}
                  onChangeText={setLocation}
                  monoLabel
                />
                <Button
                  label="관측 시작하기"
                  fullWidth
                  onPress={() => setActiveTab('records')}
                />
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
  scrollContent: {
    gap: 12,
    paddingBottom: 20,
  },
  mapOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
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
