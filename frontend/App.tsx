/**
 * StarChaser — App.tsx
 * 메인: 천구 + TOP3 · 지도 마커: Star-Index 상세 시트
 */

import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Text,
  StyleSheet,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  NOTIFICATION_PREFS_KEY_BASE,
  ONBOARDING_COMPLETED_KEY_BASE,
  onboardingCompletedKey,
  userScopedStorageKeys,
} from './lib/auth-storage';
import { ThemeProvider, useTheme } from './themes/ThemeContext';
import { AuthProvider, useAuth } from './contexts/auth-context';
import { BottomTab, Button, Screen } from './components/ui';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { SplashScreen } from './components/splash/SplashScreen';
import {
  KakaoMapWebView,
  type KakaoMapWebViewHandle,
} from './components/map/KakaoMapWebView';
import { MapClusterSpotsSheet } from './components/map/MapClusterSpotsSheet';
import { MapFloatingControls } from './components/map/MapFloatingControls';
import { MapSpotDetailModal } from './components/map/MapSpotDetailModal';
import { ProfileTabScreen } from './components/profile/ProfileTabScreen';
import { useDeviceLocationState } from './hooks/use-device-location';
import { useMapSpotStarIndex } from './hooks/use-map-spot-star-index';
import { useWeeklyTop3 } from './hooks/use-weekly-top3';
import { recordSpotDetailView } from './lib/spot-activity-storage';
import { fetchSpotById } from './lib/spots-api';
import { spotNameWithoutRegionPrefix } from './lib/spot-display-name';
import { MainTabScreen } from './components/main/MainTabScreen';
import { TabExploreIntro } from './components/tab-explore/TabExploreIntro';
import { RecordsTabScreen } from './components/records/RecordsTabScreen';
import { SkyTabScreen } from './components/sky/SkyTabScreen';
import { useObserverStarIndex } from './lib/observer-star-index';
import { AuthScreen } from './components/auth/auth-screen';
import { getDefaultSpotId } from './lib/config';
import * as Location from 'expo-location';
import { starIndexCardErrorFromApi } from './lib/star-index-errors';
import type { ClusterSpotRnDto } from './lib/types/map-spot';

function AppContent() {
  const { theme, toggleRed, isRedMode } = useTheme();
  const { user, logout, onSessionInvalidated } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('main');
  /** MAP 탭을 한 번 연 뒤에는 WebView를 유지해 줌/센터·마커 상태가 탭 전환 후에도 유지되게 함 */
  const [mapLayerMounted, setMapLayerMounted] = useState(false);
  /** SKY·MAP — 탭 진입 시 인트로 → 탐험 버튼 후 본 화면 */
  const [skyExploring, setSkyExploring] = useState(false);
  const [mapExploring, setMapExploring] = useState(false);
  const skyContentFade = useRef(new Animated.Value(0)).current;
  const mapContentFade = useRef(new Animated.Value(0)).current;

  const EXPLORE_FADE_IN_MS = 420;

  const {
    deviceLat,
    deviceLng,
    foregroundLocationStatus,
    locationEnabledPref,
    locationPrefLoaded,
    locationToggleBusy,
    useDeviceLocation: deviceLocationActive,
    hasObserverGps,
    requestLocationPermission,
    handleLocationEnabledChange,
    openLocationSettings,
    refreshForegroundLocationStatus,
  } = useDeviceLocationState(user?.id);

  const mapWebViewRef = useRef<KakaoMapWebViewHandle>(null);
  /** 지도 webview 준비 여부 + 준비 전에 들어온 포커스 요청 보류 */
  const mapReadyRef = useRef(false);
  const pendingMapFocusRef = useRef<{
    lat: number;
    lng: number;
    label: string;
    spotId: string;
  } | null>(null);

  // Map: 마커 클릭 → 상세 시트
  const [mapSpotId, setMapSpotId] = useState<string | null>(null);
  const [mapDetailOpen, setMapDetailOpen] = useState(false);
  /** 광역·격자 클러스터 탭 → 명소 목록 시트 */
  const [mapClusterSheet, setMapClusterSheet] = useState<{
    title: string;
    spots: ClusterSpotRnDto[];
  } | null>(null);
  /** MAP 탭 — NASA VIIRS 타일 오버레이 ON/OFF */
  const [mapViirsEnabled, setMapViirsEnabled] = useState(false);
  const [mapClusterScoreRefreshToken, setMapClusterScoreRefreshToken] = useState(0);

  const defaultSpotId = getDefaultSpotId();
  /** TOP3·관측 로그 기준 명소 — 지도 선택과 별개로 유지 */
  const [focusSpotId, setFocusSpotId] = useState<string | null>(() => getDefaultSpotId() ?? null);

  useEffect(() => {
    setFocusSpotId((prev) => (prev == null && defaultSpotId ? defaultSpotId : prev));
  }, [defaultSpotId]);

  const [mapPreviewReady, setMapPreviewReady] = useState(false);

  useEffect(() => {
    if (activeTab === 'map') {
      setMapLayerMounted(true);
      if (mapReadyRef.current) {
        setMapPreviewReady(true);
      }
    } else {
      setMapExploring(false);
      mapContentFade.setValue(0);
      mapWebViewRef.current?.clearMapFocus();
    }
    if (activeTab !== 'sky') {
      setSkyExploring(false);
      skyContentFade.setValue(0);
    }
  }, [activeTab, mapContentFade, skyContentFade]);

  const fadeInContent = useCallback((anim: Animated.Value) => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: EXPLORE_FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const enterSkyExplore = useCallback(() => {
    setSkyExploring(true);
    fadeInContent(skyContentFade);
  }, [fadeInContent, skyContentFade]);

  const enterMapExplore = useCallback(() => {
    setMapExploring(true);
    fadeInContent(mapContentFade);
  }, [fadeInContent, mapContentFade]);

  const enterMapExploreImmediate = useCallback(() => {
    setMapExploring(true);
    setMapLayerMounted(true);
    mapContentFade.setValue(1);
  }, [mapContentFade]);

  const [spotActivityRevision, setSpotActivityRevision] = useState(0);
  const refreshMySpots = useCallback(() => {
    setSpotActivityRevision((r) => r + 1);
  }, []);

  const observerStarIndex = useObserverStarIndex({
    activeSpotId: focusSpotId,
    observerLat: deviceLat,
    observerLng: deviceLng,
    useDeviceLocation: deviceLocationActive,
    locationPrefLoaded,
    locationEnabled: locationEnabledPref,
    locationPermissionStatus: foregroundLocationStatus,
    onSessionInvalidated,
  });

  const onMapMyLocation = useCallback(() => {
    if (deviceLat != null && deviceLng != null && Number.isFinite(deviceLat) && Number.isFinite(deviceLng)) {
      mapWebViewRef.current?.focusMap(deviceLat, deviceLng, 7, '내 위치');
      return;
    }
    void requestLocationPermission();
  }, [deviceLat, deviceLng, requestLocationPermission]);

  const {
    loading: top3Loading,
    error: top3Error,
    items: top3Items,
  } = useWeeklyTop3(activeTab === 'main', onSessionInvalidated);

  const {
    loading: mapSiLoading,
    error: mapSiError,
    data: mapSiData,
    load: loadMapSpotStarIndex,
    reset: resetMapSpotStarIndex,
  } = useMapSpotStarIndex(onSessionInvalidated);

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

  const kakaoJavascriptKey = process.env.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  const kakaoMapPageUrl = process.env.EXPO_PUBLIC_KAKAO_MAP_PAGE_URL;

  const openMapSpotDetail = useCallback(
    (spotId: string) => {
      setActiveTab('map');
      enterMapExploreImmediate();
      setFocusSpotId(spotId);
      setMapSpotId(spotId);
      setMapDetailOpen(true);
      loadMapSpotStarIndex(spotId);
      if (user?.id) {
        void recordSpotDetailView(user.id, spotId).then(refreshMySpots);
      }
    },
    [user?.id, loadMapSpotStarIndex, refreshMySpots, enterMapExploreImmediate],
  );

  /** 상세 시트는 열지 않고 MAP 탭으로 전환해 해당 명소 위치로만 이동(포커스). 조회수 미집계. */
  const focusMapOnSpot = useCallback((spotId: string) => {
    setActiveTab('map');
    enterMapExploreImmediate();
    setFocusSpotId(spotId);
    void (async () => {
      try {
        const spot = await fetchSpotById(spotId);
        const label = spotNameWithoutRegionPrefix(spot.name) || spot.name;
        const focus = { lat: spot.lat, lng: spot.lng, label, spotId: spot.id };
        if (mapReadyRef.current) {
          mapWebViewRef.current?.focusMap(focus.lat, focus.lng, 7, focus.label, focus.spotId);
        } else {
          // 지도 준비 전이면 MAP_READY 이후 적용
          pendingMapFocusRef.current = focus;
        }
      } catch {
        // 좌표 조회 실패 시 포커스는 생략 (탭 전환은 유지)
      }
    })();
  }, [enterMapExploreImmediate]);

  const isTabIntro =
    (activeTab === 'sky' && !skyExploring) || (activeTab === 'map' && !mapExploring);
  const showFullBleedTab =
    isTabIntro ||
    (activeTab === 'sky' && skyExploring) ||
    (activeTab === 'map' && mapExploring);

  const fullBleedEdges = ['bottom', 'left', 'right'] as const;

  const syncAndroidSystemChrome = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const bg = theme.background;
    try {
      await SystemUI.setBackgroundColorAsync(bg);
      await NavigationBar.setBackgroundColorAsync(bg);
      await NavigationBar.setButtonStyleAsync('light');
      await NavigationBar.setBorderColorAsync(bg);
    } catch {
      // 웹·미지원 환경 무시
    }
  }, [theme.background]);

  useEffect(() => {
    void syncAndroidSystemChrome();
  }, [syncAndroidSystemChrome, activeTab, showFullBleedTab]);

  return (
    <Screen
      noPadding
      edges={showFullBleedTab ? [...fullBleedEdges] : undefined}
    >
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        {/* 지도는 이 영역 안에서만 absoluteFill → 하단 탭과 레이아웃 겹침 없음 */}
        <View style={styles.mainTabContent}>
        {mapLayerMounted ? (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              activeTab === 'map'
                ? mapExploring
                  ? { opacity: mapContentFade }
                  : styles.mapIntroPreview
                : styles.mapTabLayerHidden,
            ]}
            pointerEvents={activeTab === 'map' && mapExploring ? 'auto' : 'none'}
            collapsable={false}
          >
            <View style={{ flex: 1 }}>
            <KakaoMapWebView
              ref={mapWebViewRef}
              mapPageUrl={kakaoMapPageUrl}
              kakaoJavascriptKey={kakaoJavascriptKey}
              spotListMode="all"
              showUserLocation={deviceLocationActive}
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
                if (msg.type === 'CLUSTER_SPOTS') {
                  const d = msg.data;
                  setMapClusterScoreRefreshToken((t) => t + 1);
                  if (d.kind === 'province') {
                    setMapClusterSheet({
                      title: `${d.regionKey} · 명소 ${d.spots.length}곳`,
                      spots: d.spots,
                    });
                  } else {
                    setMapClusterSheet({
                      title: `이 구역 · 명소 ${d.spots.length}곳`,
                      spots: d.spots,
                    });
                  }
                  return;
                }
                if (msg.type === 'MAP_READY') {
                  mapReadyRef.current = true;
                  setMapPreviewReady(true);
                  const pending = pendingMapFocusRef.current;
                  if (pending) {
                    pendingMapFocusRef.current = null;
                    mapWebViewRef.current?.focusMap(
                      pending.lat,
                      pending.lng,
                      7,
                      pending.label,
                      pending.spotId,
                    );
                  }
                }
                if (msg.type === 'MARKER_CLICK') {
                  openMapSpotDetail(msg.data.spotId);
                }
              }}
            />

            {mapExploring ? (
              <MapFloatingControls
                theme={theme}
                viirsEnabled={mapViirsEnabled}
                onToggleViirs={() => setMapViirsEnabled((v) => !v)}
                onMyLocation={onMapMyLocation}
                locationReady={deviceLat != null && deviceLng != null}
              />
            ) : null}
            </View>
          </Animated.View>
        ) : null}
        {activeTab !== 'map' ? (
          activeTab === 'main' ? (
            <MainTabScreen
              activeSpotId={focusSpotId}
              observerLat={deviceLat}
              observerLng={deviceLng}
              starIndexData={observerStarIndex.data}
              starIndexLoading={observerStarIndex.loading}
              starIndexAwaitingLocation={observerStarIndex.awaitingLocation}
              starIndexError={observerStarIndex.error}
              starIndexPlaceLabel={observerStarIndex.placeLabel}
              locationUnavailable={observerStarIndex.locationUnavailable}
              onReloadStarIndex={() => void observerStarIndex.reload()}
              top3Loading={top3Loading}
              top3Error={top3Error}
              top3Items={top3Items}
              selectedSpotId={focusSpotId}
              onSelectTop3Spot={focusMapOnSpot}
              onSessionInvalidated={onSessionInvalidated}
            />
          ) : activeTab === 'sky' ? (
            skyExploring ? (
              <Animated.View style={[styles.exploreContent, { opacity: skyContentFade }]}>
                <SkyTabScreen
                  observerLat={deviceLat}
                  observerLng={deviceLng}
                  observerSpotId={focusSpotId}
                  observeAtIso={skyObserveAtIso}
                  onShiftHours={shiftSkyObserveHours}
                  onObserveNow={resetSkyObserveNow}
                  onSessionInvalidated={onSessionInvalidated}
                  skyUsesGps={deviceLocationActive && deviceLat != null && deviceLng != null}
                  locationFeaturesEnabled={locationEnabledPref}
                  locationPermissionStatus={foregroundLocationStatus}
                  onRequestLocationPermission={async () => {
                    await handleLocationEnabledChange(true);
                  }}
                />
              </Animated.View>
            ) : (
              <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
                <TabExploreIntro variant="sky" onExplore={enterSkyExplore} />
              </View>
            )
          ) : activeTab === 'records' ? (
            <RecordsTabScreen
              observerLat={deviceLat}
              observerLng={deviceLng}
              useDeviceLocation={deviceLocationActive}
              onSessionInvalidated={onSessionInvalidated}
              starIndexPlaceLabel={observerStarIndex.placeLabel}
            />
          ) : activeTab === 'profile' ? (
            <ProfileTabScreen
              onLogout={() => void logout()}
              isRedMode={isRedMode}
              onToggleRedMode={toggleRed}
              onSessionInvalidated={onSessionInvalidated}
              locationEnabled={locationEnabledPref}
              locationPrefLoaded={locationPrefLoaded}
              locationPermissionStatus={foregroundLocationStatus}
              locationToggleBusy={locationToggleBusy}
              onLocationEnabledChange={(enabled) => void handleLocationEnabledChange(enabled)}
              onRefreshLocationStatus={refreshForegroundLocationStatus}
              onOpenLocationSettings={openLocationSettings}
              spotActivityRevision={spotActivityRevision}
              onOpenSpotDetail={openMapSpotDetail}
            />
          ) : null
        ) : !mapExploring ? (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <TabExploreIntro
              variant="map"
              onExplore={enterMapExplore}
              mapPreviewReady={mapPreviewReady}
            />
          </View>
        ) : null}
        </View>

        <MapClusterSpotsSheet
          visible={mapClusterSheet != null}
          title={mapClusterSheet?.title ?? ''}
          spots={mapClusterSheet?.spots ?? []}
          scoreRefreshToken={mapClusterScoreRefreshToken}
          onClose={() => setMapClusterSheet(null)}
          onSessionInvalidated={onSessionInvalidated}
          onPickSpot={(spot) => {
            const label =
              spot.shortTitle?.trim() ||
              spot.title?.trim() ||
              `명소 ${spot.id.slice(0, 8)}`;
            mapWebViewRef.current?.focusMap(spot.lat, spot.lng, 7, label, spot.id);
          }}
        />

        <MapSpotDetailModal
          visible={mapDetailOpen}
          onClose={() => {
            if (mapSiData) {
              setMapClusterScoreRefreshToken((t) => t + 1);
            }
            setMapDetailOpen(false);
            setMapSpotId(null);
            resetMapSpotStarIndex();
          }}
          spotId={mapSpotId}
          loading={mapSiLoading}
          error={mapSiError}
          data={mapSiData}
          onRetry={() => mapSpotId && loadMapSpotStarIndex(mapSpotId)}
          onSessionInvalidated={onSessionInvalidated}
          starIndexErrorFromApi={starIndexCardErrorFromApi}
          onBookmarkChange={refreshMySpots}
        />

        <View>
          <BottomTab
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'main', label: 'MAIN', icon: 'home', redIcon: '⌂' },
              { key: 'sky', label: 'SKY', icon: 'sky', redIcon: '◉' },
              { key: 'map', label: 'MAP', icon: 'map', redIcon: '◈' },
              { key: 'records', label: 'DIARY', icon: 'log', redIcon: '≡' },
              { key: 'profile', label: 'ME', icon: 'me', redIcon: '○' },
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
        <ActivityIndicator color={theme.primaryGlow} />
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

/** Figma 스플래시 최소 노출 시간(ms) */
const SPLASH_MIN_MS = 2200;

/**
 * 인증 후 온보딩 여부만 분기 — 로그아웃 시 AuthScreen
 */
function AppGate() {
  const { isHydrated, isAuthenticated, user } = useAuth();
  const [route, setRoute] = useState<'boot' | 'onboarding' | 'ready'>('boot');
  const [splashMinDone, setSplashMinDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashMinDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    // 인증 직후 user가 아직 세팅 전이면 잠깐 대기
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      try {
        const completedKey = onboardingCompletedKey(user.id);
        const staleGlobalKeys = [
          ONBOARDING_COMPLETED_KEY_BASE,
          NOTIFICATION_PREFS_KEY_BASE,
        ];

        const completed = await AsyncStorage.getItem(completedKey);
        if (!mounted) return;

        if (completed === 'true') {
          setRoute('ready');
          return;
        }
        void AsyncStorage.multiRemove(staleGlobalKeys);
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

  const resolvingAfterAuth = isAuthenticated && route === 'boot';
  const showSplash = !splashMinDone || !isHydrated || resolvingAfterAuth;

  if (showSplash) return <SplashScreen />;

  if (!isAuthenticated) return <AuthScreen />;
  if (route === 'onboarding') {
    // userId가 없으면 (드물게) 로딩 유지
    if (!user?.id) return <AppLoading />;
    return <OnboardingFlow userId={user.id} onDone={() => setRoute('ready')} />;
  }
  return <AppContent />;
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
  exploreContent: {
    flex: 1,
  },
  mapTabLayerHidden: {
    opacity: 0,
  },
  /** MAP 인트로 뒤 — 실제 지도가 흐릿하게 비치도록 */
  mapIntroPreview: {
    opacity: 1,
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
