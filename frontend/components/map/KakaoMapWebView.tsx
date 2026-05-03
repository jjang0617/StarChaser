import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import {
  fetchSpotsAll,
  fetchSpotsNearby,
  SessionExpiredError,
  spotDtoToMapSpot,
} from '../../lib/spots-api';
import type { LatLng, MapSpot } from '../../lib/types/map-spot';
import { buildKakaoMapInlineHtml } from './kakao-map-inline-html';

export type { LatLng, MapSpot } from '../../lib/types/map-spot';

export type SpotListMode = 'nearby' | 'all';

/** VIIRS Black Marble 합성(구름 영향 적고 “도시빛”에 가까움). */
const DEFAULT_VIIRS_LAYER_ID = 'VIIRS_Black_Marble';

function getApiBaseUrlFromEnv(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  return (url || 'http://127.0.0.1:3333').replace(/\/+$/, '');
}

type RNToWebMessage =
  | { type: 'INIT'; data?: { center?: LatLng; level?: number } }
  | { type: 'SET_CURRENT_LOCATION'; data: LatLng }
  | { type: 'CLEAR_CURRENT_LOCATION' }
  | { type: 'SET_SPOTS'; data: MapSpot[] }
  | {
      type: 'SET_VIIRS_LAYER';
      data: {
        enabled: boolean;
        /** WMS 프록시용 백엔드 base url */
        backendBaseUrl?: string;
        time?: string;
        layer?: string;
        opacity?: number;
        copyrightMsg?: string;
        copyrightShortMsg?: string;
      };
    };

type WebToRNMessage =
  | { type: 'MAP_READY' }
  | { type: 'MARKER_CLICK'; data: { spotId: string } }
  | { type: 'VIIRS_LAYER_READY'; data?: Record<string, unknown> }
  | { type: 'VIIRS_LAYER_ERROR'; data?: { message?: string } };

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * RN → WebView 페이지(kakao.html)
 * 일부 플랫폼에서는 synthetic MessageEvent가 window 리스너에 안 들어오므로
 * 페이지가 노출하는 `__STAR_CHASER_RN_BRIDGE`를 우선 호출한다.
 */
function injectWebMessage(webView: WebView | null, msg: RNToWebMessage) {
  if (!webView) return;
  const raw = JSON.stringify(msg);
  const script = `
(function () {
  try {
    var raw = ${JSON.stringify(raw)};
    if (typeof window.__STAR_CHASER_RN_BRIDGE === 'function') {
      window.__STAR_CHASER_RN_BRIDGE(raw);
    } else {
      window.dispatchEvent(new MessageEvent('message', { data: raw }));
      document.dispatchEvent(new MessageEvent('message', { data: raw }));
    }
  } catch (_) {}
  true;
})();
`;
  webView.injectJavaScript(script);
}

export function KakaoMapWebView({
  mapPageUrl,
  kakaoJavascriptKey,
  onMessage,
  /** MAP_READY 이후 expo-location으로 내 위치 마커 (기본 true) */
  showUserLocation = true,
  /** `nearby`: GET /spots/nearby(위치 확보 후) · `all`: GET /spots */
  spotListMode = 'nearby' as SpotListMode,
  /** nearby 반경(미터) */
  spotsNearbyRadiusM = 50000,
  /** spots API에서 401/세션 만료 시 */
  onSessionExpired,
  /** NASA GIBS WMS(bounds 이미지) 오버레이 */
  viirsLayerEnabled = false,
  viirsOpacity = 0.75,
  viirsCopyrightMsg,
  viirsCopyrightShortMsg,
  // Black Marble은 TIME 없이도 동작(서버가 TIME 생략)
  viirsTime = '',
  viirsLayer = DEFAULT_VIIRS_LAYER_ID,
}: {
  mapPageUrl?: string;
  kakaoJavascriptKey: string | undefined;
  onMessage?: (msg: WebToRNMessage) => void;
  showUserLocation?: boolean;
  spotListMode?: SpotListMode;
  spotsNearbyRadiusM?: number;
  onSessionExpired?: () => void | Promise<void>;
  viirsLayerEnabled?: boolean;
  viirsOpacity?: number;
  viirsCopyrightMsg?: string;
  viirsCopyrightShortMsg?: string;
  viirsTime?: string;
  viirsLayer?: string;
}) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  /** nearby: 첫 GPS 좌표(주변 spots API 트리거) */
  const [coordsForSpots, setCoordsForSpots] = useState<LatLng | null>(null);

  const html = useMemo(
    () => buildKakaoMapInlineHtml(kakaoJavascriptKey ?? ''),
    [kakaoJavascriptKey],
  );

  const sendToWeb = useCallback((msg: RNToWebMessage) => {
    injectWebMessage(webViewRef.current, msg);
  }, []);

  const handleMessage = (e: WebViewMessageEvent) => {
    const parsed = safeJsonParse<WebToRNMessage>(e.nativeEvent.data);
    if (!parsed) return;
    if (parsed.type === 'MAP_READY') {
      setMapReady(true);
    }
    onMessage?.(parsed);
  };

  const hasHostedPage = Boolean(mapPageUrl?.trim());
  const canUseInlineFallback = Boolean(kakaoJavascriptKey);

  const viirsBackendBaseResolved = useMemo(() => getApiBaseUrlFromEnv(), []);

  // VIIRS 타일 오버레이 토글 (MAP_READY 이후). WebView ref/브리지 준비용으로 한 번 재전송한다.
  useEffect(() => {
    if (!mapReady) return;

    const enabled = Boolean(viirsLayerEnabled);
    const payload: RNToWebMessage = {
      type: 'SET_VIIRS_LAYER',
      data: {
        enabled,
        backendBaseUrl: viirsBackendBaseResolved,
        time: viirsTime,
        layer: viirsLayer,
        opacity: viirsOpacity,
        copyrightMsg: viirsCopyrightMsg,
        copyrightShortMsg: viirsCopyrightShortMsg,
      },
    };
    sendToWeb(payload);
    const t = setTimeout(() => sendToWeb(payload), 280);
    return () => clearTimeout(t);
  }, [
    mapReady,
    viirsLayerEnabled,
    viirsBackendBaseResolved,
    viirsTime,
    viirsLayer,
    viirsOpacity,
    viirsCopyrightMsg,
    viirsCopyrightShortMsg,
    sendToWeb,
  ]);

  // Step 2: MAP_READY 후 위치 권한 → SET_CURRENT_LOCATION (갱신은 watch)
  useEffect(() => {
    if (!mapReady || !showUserLocation) return;

    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[KakaoMap] 위치 권한 거부');
        }
        return;
      }

      const pushLocation = (coords: { latitude: number; longitude: number }) => {
        if (cancelled) return;
        sendToWeb({
          type: 'SET_CURRENT_LOCATION',
          data: { lat: coords.latitude, lng: coords.longitude },
        });
        if (spotListMode === 'nearby') {
          setCoordsForSpots((prev) => prev ?? { lat: coords.latitude, lng: coords.longitude });
        }
      };

      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        pushLocation(current.coords);
      } catch {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[KakaoMap] 현재 위치 1회 조회 실패');
        }
      }

      try {
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 10000,
          },
          (loc) => pushLocation(loc.coords),
        );
        if (cancelled) {
          sub.remove();
          sub = null;
        }
      } catch {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[KakaoMap] 위치 watch 실패');
        }
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      sendToWeb({ type: 'CLEAR_CURRENT_LOCATION' });
    };
  }, [mapReady, showUserLocation, spotListMode, sendToWeb]);

  // nearby + 내 위치 끔: 좌표만 한 번 받아 spots API에 사용
  useEffect(() => {
    if (!mapReady || spotListMode !== 'nearby' || showUserLocation) return;

    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setCoordsForSpots((prev) => prev ?? { lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[KakaoMap] spots용 현재 위치 조회 실패');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, spotListMode, showUserLocation]);

  // all: GET /spots
  useEffect(() => {
    if (!mapReady || spotListMode !== 'all') return;
    let cancelled = false;
    (async () => {
      try {
        const dtos = await fetchSpotsAll();
        if (cancelled) return;
        sendToWeb({ type: 'SET_SPOTS', data: dtos.map(spotDtoToMapSpot) });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof SessionExpiredError) {
          await onSessionExpired?.();
          return;
        }
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[KakaoMap] fetchSpotsAll', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, spotListMode, sendToWeb, onSessionExpired]);

  // nearby: 좌표 있으면 GET /spots/nearby
  useEffect(() => {
    if (!mapReady || spotListMode !== 'nearby') return;
    if (!coordsForSpots) return;
    let cancelled = false;
    (async () => {
      try {
        const dtos = await fetchSpotsNearby(
          coordsForSpots.lat,
          coordsForSpots.lng,
          spotsNearbyRadiusM,
        );
        if (cancelled) return;
        sendToWeb({ type: 'SET_SPOTS', data: dtos.map(spotDtoToMapSpot) });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof SessionExpiredError) {
          await onSessionExpired?.();
          return;
        }
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[KakaoMap] fetchSpotsNearby', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, spotListMode, coordsForSpots, spotsNearbyRadiusM, sendToWeb, onSessionExpired]);

  // nearby: 좌표가 오래 없으면 GET /spots 로 폴백
  useEffect(() => {
    if (!mapReady || spotListMode !== 'nearby') return;
    if (coordsForSpots) return;
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const dtos = await fetchSpotsAll();
          if (cancelled) return;
          sendToWeb({ type: 'SET_SPOTS', data: dtos.map(spotDtoToMapSpot) });
        } catch (e) {
          if (cancelled) return;
          if (e instanceof SessionExpiredError) {
            await onSessionExpired?.();
            return;
          }
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[KakaoMap] fetchSpotsAll (nearby fallback)', e);
          }
        }
      })();
    }, 10_000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mapReady, spotListMode, coordsForSpots, sendToWeb, onSessionExpired]);

  const androidLayer = Platform.OS === 'android' ? { opacity: 0.99 } : null;

  return (
    <View style={{ flex: 1 }}>
      {!hasHostedPage && !canUseInlineFallback && (
        <View style={{ padding: 12 }}>
          <Text style={{ fontSize: 12, opacity: 0.8 }}>
            EXPO_PUBLIC_KAKAO_MAP_PAGE_URL을 frontend/.env에 설정하세요.
          </Text>
        </View>
      )}
      <View style={[{ flex: 1 }, androidLayer]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={
            hasHostedPage
              ? { uri: mapPageUrl!.trim() }
              : canUseInlineFallback
                ? { html }
                : { html: '<html><body style="margin:0"></body></html>' }
          }
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
        />
      </View>
    </View>
  );
}
