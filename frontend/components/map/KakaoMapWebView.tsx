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

        /** VIIRS WMS 오버레이 (bounds 기반 이미지 1장 덮기) */
        var viirsWmsEnabled = false;
        var viirsWmsImg = null;
        var viirsWmsLastUrl = '';
        var viirsWmsUpdateTimer = null;
        var viirsWmsConfig = {
          backendBaseUrl: '',
          opacity: 0.75,
          time: '',
          layer: 'VIIRS_Black_Marble',
        };

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

          // 지도 이동/줌 끝날 때마다 bounds 기반 WMS 이미지 갱신
          try {
            kakao.maps.event.addListener(map, 'idle', function () {
              scheduleViirsWmsUpdate();
            });
          } catch (e) {}
        }

        function ensureViirsWmsImg() {
          var container = document.getElementById('map');
          if (!container) return null;
          if (viirsWmsImg) return viirsWmsImg;

          var img = document.createElement('img');
          img.alt = 'VIIRS overlay';
          img.style.cssText =
            'position:absolute;left:0;top:0;width:100%;height:100%;' +
            'pointer-events:none;z-index:2;opacity:' + String(viirsWmsConfig.opacity) + ';';

          var parent = container.parentElement;
          if (parent) {
            var cs = window.getComputedStyle(parent);
            if (cs.position === 'static') parent.style.position = 'relative';
            parent.appendChild(img);
          } else {
            document.body.appendChild(img);
          }
          viirsWmsImg = img;
          return img;
        }

        function scheduleViirsWmsUpdate() {
          if (!viirsWmsEnabled) return;
          if (!viirsWmsConfig.backendBaseUrl) return;
          if (!map) return;
          if (viirsWmsUpdateTimer) clearTimeout(viirsWmsUpdateTimer);
          viirsWmsUpdateTimer = setTimeout(function () {
            viirsWmsUpdateTimer = null;
            updateViirsWmsImage();
          }, 150);
        }

        function updateViirsWmsImage() {
          if (!viirsWmsEnabled) return;
          if (!viirsWmsConfig.backendBaseUrl) return;
          if (!map) return;

          var bounds = map.getBounds && map.getBounds();
          if (!bounds) return;
          var sw = bounds.getSouthWest();
          var ne = bounds.getNorthEast();
          if (!sw || !ne) return;

          var container = document.getElementById('map');
          var w = container ? container.clientWidth : 512;
          var h = container ? container.clientHeight : 512;
          w = Math.max(64, Math.min(2048, w || 512));
          h = Math.max(64, Math.min(2048, h || 512));

          var url =
            viirsWmsConfig.backendBaseUrl.replace(/\/+$/, '') +
            '/viirs/wms' +
            '?west=' + encodeURIComponent(sw.getLng()) +
            '&south=' + encodeURIComponent(sw.getLat()) +
            '&east=' + encodeURIComponent(ne.getLng()) +
            '&north=' + encodeURIComponent(ne.getLat()) +
            '&w=' + encodeURIComponent(w) +
            '&h=' + encodeURIComponent(h) +
            (viirsWmsConfig.time ? ('&time=' + encodeURIComponent(viirsWmsConfig.time)) : '') +
            '&layer=' + encodeURIComponent(viirsWmsConfig.layer || 'VIIRS_Black_Marble') +
            '&format=' + encodeURIComponent('image/png');

          if (url === viirsWmsLastUrl) return;
          viirsWmsLastUrl = url;

          var img = ensureViirsWmsImg();
          if (!img) return;
          img.style.display = viirsWmsEnabled ? 'block' : 'none';
          img.style.opacity = String(viirsWmsConfig.opacity);
          img.src = url;
        }

        function setViirsWmsEnabled(enabled) {
          viirsWmsEnabled = !!enabled;
          var img = ensureViirsWmsImg();
          if (img) {
            img.style.display = viirsWmsEnabled ? 'block' : 'none';
          }
          if (viirsWmsEnabled) scheduleViirsWmsUpdate();
        }

        function applyViirsLayer(data) {
          if (!map) {
            post({ type: 'VIIRS_LAYER_ERROR', data: { message: 'MAP_NOT_READY' } });
            return;
          }

          var enabled = !!(data && data.enabled);
          if (!enabled) {
            setViirsWmsEnabled(false);
            post({ type: 'VIIRS_LAYER_READY', data: { mapTypeId: 'VIIRS_WMS', enabled: false } });
            return;
          }

          viirsWmsConfig.backendBaseUrl = data && data.backendBaseUrl ? String(data.backendBaseUrl) : '';
          viirsWmsConfig.opacity =
            data && typeof data.opacity === 'number' ? Math.max(0, Math.min(1, data.opacity)) : (viirsWmsConfig.opacity || 0.75);
          viirsWmsConfig.time = (data && data.time ? String(data.time) : viirsWmsConfig.time) || '';
          viirsWmsConfig.layer = (data && data.layer ? String(data.layer) : viirsWmsConfig.layer) || 'VIIRS_Black_Marble';

          if (!viirsWmsConfig.backendBaseUrl) {
            post({ type: 'VIIRS_LAYER_ERROR', data: { message: 'MISSING_BACKEND_BASE_URL' } });
            return;
          }

          setViirsWmsEnabled(true);
          post({ type: 'VIIRS_LAYER_READY', data: { mapTypeId: 'VIIRS_WMS', enabled: true } });
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
          var bounds = new kakao.maps.LatLngBounds();
          var hasAny = false;
          spots.forEach(function (s) {
            if (!s || !s.id) return;
            var pos = new kakao.maps.LatLng(s.lat, s.lng);
            bounds.extend(pos);
            hasAny = true;
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

          // 마커가 여러 개면 화면에 모두 보이게 이동/줌 (1개면 과도한 줌 변화 방지)
          if (hasAny && spots.length >= 2) {
            try {
              map.setBounds(bounds, 60, 60, 60, 60);
            } catch (e) {}
          }
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
            case 'SET_VIIRS_LAYER':
              applyViirsLayer(msg.data || {});
              break;
          }
        }

        window.__STAR_CHASER_RN_BRIDGE = function (raw) {
          handleMessage(raw);
        };
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
