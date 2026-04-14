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

export type { LatLng, MapSpot } from '../../lib/types/map-spot';

export type SpotListMode = 'sample' | 'nearby' | 'all';

type RNToWebMessage =
  | { type: 'INIT'; data?: { center?: LatLng; level?: number } }
  | { type: 'SET_CURRENT_LOCATION'; data: LatLng }
  | { type: 'CLEAR_CURRENT_LOCATION' }
  | { type: 'SET_SPOTS'; data: MapSpot[] };

type WebToRNMessage =
  | { type: 'MAP_READY' }
  | { type: 'MARKER_CLICK'; data: { spotId: string } };

/** Step 3: API 없이 마커 검증용 — 별 관측 인기 명소(대략 좌표) */
export const SAMPLE_MAP_SPOTS: MapSpot[] = [
  { id: 'yeongwol-byeolmaro', title: '영월 별마로천문대', lat: 37.1865, lng: 128.471 },
  { id: 'cheongsong-juwangsan', title: '청송 주왕산', lat: 36.4045, lng: 129.1592 },
  { id: 'taebaeksan', title: '태백산 국립공원', lat: 37.0972, lng: 128.9231 },
];

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** RN → 호스팅 kakao.html: MessageEvent로 handleMessage와 동일 경로 전달 */
function injectWebMessage(webView: WebView | null, msg: RNToWebMessage) {
  if (!webView) return;
  const payload = JSON.stringify(msg);
  const script = `
    (function () {
      try {
        var data = ${JSON.stringify(payload)};
        window.dispatchEvent(new MessageEvent('message', { data: data }));
        document.dispatchEvent(new MessageEvent('message', { data: data }));
      } catch (e) {}
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
  /** `sample`: spots prop만 사용 · `nearby`: GET /spots/nearby(위치 확보 후) · `all`: GET /spots */
  spotListMode = 'nearby' as SpotListMode,
  /** nearby 반경(미터) */
  spotsNearbyRadiusM = 50000,
  /** spotListMode === `sample` 일 때만 사용 (기본 샘플 3곳) */
  spots = SAMPLE_MAP_SPOTS,
  /** spots API에서 401/세션 만료 시 */
  onSessionExpired,
}: {
  mapPageUrl?: string;
  kakaoJavascriptKey: string | undefined;
  onMessage?: (msg: WebToRNMessage) => void;
  showUserLocation?: boolean;
  spotListMode?: SpotListMode;
  spotsNearbyRadiusM?: number;
  spots?: MapSpot[];
  onSessionExpired?: () => void | Promise<void>;
}) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  /** nearby: 첫 GPS 좌표(주변 spots API 트리거) */
  const [coordsForSpots, setCoordsForSpots] = useState<LatLng | null>(null);

  const html = useMemo(() => {
    return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <style>
      html, body { height: 100%; margin: 0; padding: 0; }
      #map { height: 100%; width: 100%; }
      #fallback { padding: 12px; font-family: -apple-system, system-ui, Segoe UI, Roboto; }
    </style>
    <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJavascriptKey}&autoload=false"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      (function () {
        var map;
        var currentMarker = null;
        var spotMarkers = new Map();

        function escapeHtml(str) {
          if (str == null || str === '') return '';
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        }

        function post(msg) {
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
          } catch (e) {}
        }

        function ensureKakao() {
          return typeof window.kakao !== 'undefined' && window.kakao.maps;
        }

        function initMap(opts) {
          if (!ensureKakao()) return;
          var container = document.getElementById('map');
          var center = opts && opts.center ? new kakao.maps.LatLng(opts.center.lat, opts.center.lng) : new kakao.maps.LatLng(37.5665, 126.9780);
          var level = (opts && opts.level) ? opts.level : 7;
          map = new kakao.maps.Map(container, { center: center, level: level });
          post({ type: 'MAP_READY' });
        }

        function setCurrentLocation(loc) {
          if (!map || !loc) return;
          var pos = new kakao.maps.LatLng(loc.lat, loc.lng);
          map.setCenter(pos);
          if (currentMarker) currentMarker.setMap(null);
          currentMarker = new kakao.maps.Marker({ position: pos });
          currentMarker.setMap(map);
        }

        function clearCurrentLocation() {
          if (currentMarker) {
            currentMarker.setMap(null);
            currentMarker = null;
          }
        }

        function clearSpots() {
          spotMarkers.forEach(function (m) { m.setMap(null); });
          spotMarkers.clear();
        }

        function setSpots(spots) {
          if (!map || !Array.isArray(spots)) return;
          clearSpots();
          spots.forEach(function (s) {
            if (!s || !s.id) return;
            var pos = new kakao.maps.LatLng(s.lat, s.lng);
            var label = escapeHtml(s.title || '명소');
            var el = document.createElement('div');
            el.style.cssText =
              'display:inline-flex;align-items:center;gap:4px;padding:6px 11px;' +
              'background:rgba(18,22,42,0.92);color:#fffef5;border-radius:999px;' +
              'font-size:13px;line-height:1.2;white-space:nowrap;cursor:pointer;' +
              'box-shadow:0 2px 10px rgba(0,0,0,0.35);border:1px solid rgba(255,214,120,0.45);' +
              'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
            el.innerHTML = '<span style="font-size:15px;line-height:1">⭐</span><span style="font-weight:600">' + label + '</span>';
            el.addEventListener('click', function () {
              post({ type: 'MARKER_CLICK', data: { spotId: String(s.id) } });
            });
            var overlay = new kakao.maps.CustomOverlay({
              map: map,
              position: pos,
              content: el,
              yAnchor: 1.18,
              zIndex: 5,
            });
            spotMarkers.set(String(s.id), overlay);
          });
        }

        function handleMessage(raw) {
          var msg;
          try { msg = JSON.parse(raw); } catch (e) { return; }
          if (!msg || !msg.type) return;
          switch (msg.type) {
            case 'INIT':
              initMap(msg.data || {});
              break;
            case 'SET_CURRENT_LOCATION':
              setCurrentLocation(msg.data);
              break;
            case 'CLEAR_CURRENT_LOCATION':
              clearCurrentLocation();
              break;
            case 'SET_SPOTS':
              setSpots(msg.data);
              break;
          }
        }

        document.addEventListener('message', function (e) { handleMessage(e.data); });
        window.addEventListener('message', function (e) { handleMessage(e.data); });

        if (!ensureKakao()) {
          var el = document.getElementById('map');
          el.innerHTML = '<div id="fallback">Kakao Maps SDK 로딩 실패</div>';
          return;
        }
        kakao.maps.load(function () {
          initMap({});
        });
      })();
    </script>
  </body>
</html>`;
  }, [kakaoJavascriptKey]);

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

  // sample: prop만 지도에 반영
  useEffect(() => {
    if (!mapReady || spotListMode !== 'sample') return;
    if (!spots.length) return;
    sendToWeb({ type: 'SET_SPOTS', data: spots });
  }, [mapReady, spotListMode, spots, sendToWeb]);

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
