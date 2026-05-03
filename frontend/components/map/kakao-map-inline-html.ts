/**
 * Expo Go 등에서 hosted `kakao.html` 없이 쓸 때의 WebView용 인라인 문서.
 * `map-site/kakao.html` 과 동작을 맞출 것 — VIIRS·마커 스크립트 변경 시 양쪽 수정.
 */
export function buildKakaoMapInlineHtml(kakaoJavascriptKey: string): string {
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
}
