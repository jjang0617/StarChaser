import * as Location from 'expo-location';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Text, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

import {
  fetchSpotsAll,
  fetchSpotsNearby,
  SessionExpiredError,
  spotDtoToMapSpot,
} from '../../lib/spots-api';
import type { ClusterSpotRnDto, LatLng, MapSpot } from '../../lib/types/map-spot';
import { buildKakaoMapInlineHtml } from './kakao-map-inline-html';

export type { ClusterSpotRnDto, LatLng, MapSpot } from '../../lib/types/map-spot';

/** RN에서 특정 좌표로 지도 이동·줌 (label·spotId면 명소 마커와 통합 표시) */
export type KakaoMapWebViewHandle = {
  focusMap: (
    lat: number,
    lng: number,
    level?: number,
    label?: string,
    spotId?: string,
  ) => void;
  /** 포커스 칩/별도 라벨 제거 — 다른 탭으로 나갈 때 호출 */
  clearMapFocus: () => void;
};

export type SpotListMode = 'nearby' | 'all';

/** VIIRS Black Marble 합성(구름 영향 적고 “도시빛”에 가까움). */
const DEFAULT_VIIRS_LAYER_ID = 'VIIRS_Black_Marble';

/** map-site/kakao.html(GitHub Pages) 캐시 무효화 — hosted 폴백 시에만 사용 */
const HOSTED_MAP_CACHE_VERSION = 'figma-markers-v4';

function hostedMapPageUri(url: string): string {
  const base = url.trim();
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}scv=${HOSTED_MAP_CACHE_VERSION}`;
}

function getApiBaseUrlFromEnv(): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  return (url || 'http://127.0.0.1:3333').replace(/\/+$/, '');
}

type RNToWebMessage =
  | { type: 'INIT'; data?: { center?: LatLng; level?: number } }
  | { type: 'SET_CURRENT_LOCATION'; data: LatLng }
  | { type: 'CLEAR_CURRENT_LOCATION' }
  | { type: 'SET_SPOTS'; data: MapSpot[] }
  | { type: 'FOCUS_MAP'; data: { lat: number; lng: number; level?: number; label?: string; spotId?: string } }
  | { type: 'CLEAR_MAP_FOCUS' }
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
  | {
      type: 'CLUSTER_SPOTS';
      data:
        | { kind: 'province'; regionKey: string; spots: ClusterSpotRnDto[] }
        | { kind: 'grid'; spots: ClusterSpotRnDto[] };
    }
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

export type KakaoMapWebViewProps = {
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
};

export const KakaoMapWebView = forwardRef<KakaoMapWebViewHandle, KakaoMapWebViewProps>(
  function KakaoMapWebView(
    {
      mapPageUrl,
      kakaoJavascriptKey,
      onMessage,
      showUserLocation = true,
      spotListMode = 'nearby' as SpotListMode,
      spotsNearbyRadiusM = 50000,
      onSessionExpired,
      viirsLayerEnabled = false,
      viirsOpacity = 0.75,
      viirsCopyrightMsg,
      viirsCopyrightShortMsg,
      viirsTime = '',
      viirsLayer = DEFAULT_VIIRS_LAYER_ID,
    },
    ref,
  ) {
  const webViewRef = useRef<WebView>(null);

  useImperativeHandle(
    ref,
    () => ({
      focusMap(lat: number, lng: number, level?: number, label?: string, spotId?: string) {
        injectWebMessage(webViewRef.current, {
          type: 'FOCUS_MAP',
          data: {
            lat,
            lng,
            level: level ?? 7,
            ...(label != null && String(label).trim() !== ''
              ? { label: String(label).trim() }
              : {}),
            ...(spotId != null && String(spotId).trim() !== ''
              ? { spotId: String(spotId).trim() }
              : {}),
          },
        });
      },
      clearMapFocus() {
        injectWebMessage(webViewRef.current, { type: 'CLEAR_MAP_FOCUS' });
      },
    }),
    [],
  );
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
  const canUseInlineFallback = Boolean(kakaoJavascriptKey?.trim());
  /**
   * URL이 있으면 hosted 페이지 사용 (카카오 JS SDK 도메인 검증 통과).
   * 인라인 HTML만 쓰면 WebView origin이 달라 지도가 안 뜰 수 있음.
   */
  const useBundledInlineMap = canUseInlineFallback && !hasHostedPage;

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
      {!useBundledInlineMap && !hasHostedPage && (
        <View style={{ padding: 12 }}>
          <Text style={{ fontSize: 12, opacity: 0.8 }}>
            EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY(권장) 또는 EXPO_PUBLIC_KAKAO_MAP_PAGE_URL을
            frontend/.env에 설정하세요.
          </Text>
        </View>
      )}
      <View style={[{ flex: 1 }, androidLayer]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={
            useBundledInlineMap
              ? { html }
              : hasHostedPage
                ? { uri: hostedMapPageUri(mapPageUrl!) }
                : { html: '<html><body style="margin:0"></body></html>' }
          }
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
        />
      </View>
    </View>
  );
  },
);

KakaoMapWebView.displayName = 'KakaoMapWebView';
