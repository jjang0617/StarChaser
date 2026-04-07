import React, { useMemo, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';

type LatLng = { lat: number; lng: number };
type Spot = { id: string; lat: number; lng: number; title?: string };

type RNToWebMessage =
  | { type: 'INIT'; data?: { center?: LatLng; level?: number } }
  | { type: 'SET_CURRENT_LOCATION'; data: LatLng }
  | { type: 'SET_SPOTS'; data: Spot[] };

type WebToRNMessage =
  | { type: 'MAP_READY' }
  | { type: 'MARKER_CLICK'; data: { spotId: string } };

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function KakaoMapWebView({
  /** GitHub Pages 등에서 호스팅된 kakao.html 전체 URL (예: https://org.github.io/StarChaser/kakao.html) */
  mapPageUrl,
  kakaoJavascriptKey,
  onMessage,
}: {
  mapPageUrl?: string;
  kakaoJavascriptKey: string | undefined;
  onMessage?: (msg: WebToRNMessage) => void;
}) {
  const webViewRef = useRef<WebView>(null);

  const html = useMemo(() => {
    // 도메인 제한 때문에 카카오 JS SDK는 실제 https URL에서 로드하는 편이 안전함.
    // 운영: EXPO_PUBLIC_KAKAO_MAP_PAGE_URL (GitHub Pages 기본 주소 등)

    // NOTE: ReactNativeWebView bridge is available in WebView context.
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
            var marker = new kakao.maps.Marker({ position: pos });
            marker.setMap(map);
            spotMarkers.set(String(s.id), marker);
            kakao.maps.event.addListener(marker, 'click', function () {
              post({ type: 'MARKER_CLICK', data: { spotId: String(s.id) } });
            });
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

  const handleMessage = (e: WebViewMessageEvent) => {
    const parsed = safeJsonParse<WebToRNMessage>(e.nativeEvent.data);
    if (parsed) onMessage?.(parsed);
  };

  const androidLayer = Platform.OS === 'android' ? { opacity: 0.99 } : null;

  const hasHostedPage = Boolean(mapPageUrl?.trim());
  const canUseInlineFallback = Boolean(kakaoJavascriptKey);

  return (
    <View style={{ flex: 1 }}>
      {!hasHostedPage && !canUseInlineFallback && (
        <View style={{ padding: 12 }}>
          <Text style={{ fontSize: 12, opacity: 0.8 }}>
            EXPO_PUBLIC_KAKAO_MAP_PAGE_URL(권장) 또는 EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY를 frontend/.env에 설정하세요.
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

