/**
 * Expo Go 등에서 hosted `kakao.html` 없이 쓸 때의 WebView용 인라인 문서.
 * `map-site/kakao.html` 과 동작을 맞출 것 — VIIRS·마커 스크립트 변경 시 양쪽 수정.
 *
 * 줌 전략 (Kakao map level ↑ = 더 축소/멀리):
 * - ≥13 : 명소 마커 없음(남한 베이스만)
 * - 11~12 : 시·도 단위 클러스터(regionKey)
 * - 9~10 : 격자 클러스터(근접 명소 묶음)
 * - ≤8 : 개별 핀(짧은 이름 없음·탭 시 RN 시트)
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
        var highlightOverlay = null;
        /** 클러스터 시트에서 포커스한 명소 — 개별 줌에서 도트와 pill 중복 방지 */
        var mapFocusState = null;
        var allSpotsCache = [];
        var refreshMarkersTimer = null;

        /** Kakao level ≥ 이 값이면 명소 레이어 숨김 */
        var LEVEL_HIDE_SPOTS = 13;
        /** 11~12: 광역 클러스터 */
        var LEVEL_PROVINCE_LO = 11;
        /** 9~10: 격자 클러스터 */
        var LEVEL_GRID_LO = 9;

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

        /** 남한 전체가 보이도록 — 서울 근접 확대 금지 */
        function initMap(opts) {
          if (!ensureKakao()) return;
          var container = document.getElementById('map');
          var center = opts && opts.center
            ? new kakao.maps.LatLng(opts.center.lat, opts.center.lng)
            : new kakao.maps.LatLng(36.38, 127.95);
          var level = opts && opts.level ? opts.level : 11;
          map = new kakao.maps.Map(container, { center: center, level: level });
          post({ type: 'MAP_READY' });

          try {
            kakao.maps.event.addListener(map, 'idle', function () {
              scheduleViirsWmsUpdate();
              scheduleRefreshMarkers();
            });
          } catch (e) {}
        }

        function scheduleRefreshMarkers() {
          if (refreshMarkersTimer) clearTimeout(refreshMarkersTimer);
          refreshMarkersTimer = setTimeout(function () {
            refreshMarkersTimer = null;
            refreshSpotOverlays();
          }, 90);
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

        /** 내 위치 마커만 표시 — 지도 중심은 이동하지 않음(남한 베이스 유지) */
        function setCurrentLocation(loc) {
          if (!map || !loc) return;
          var pos = new kakao.maps.LatLng(loc.lat, loc.lng);
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
          spotMarkers.forEach(function (m) {
            try {
              m.setMap(null);
            } catch (e) {}
          });
          spotMarkers.clear();
        }

        function makeClusterEl(title, count) {
          var el = document.createElement('div');
          el.style.cssText =
            'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'min-width:52px;max-width:min(42vw,200px);padding:8px 13px;' +
            'background:rgba(15,23,42,0.92);color:#f8fafc;border-radius:999px;' +
            'font-size:12px;line-height:1.2;cursor:pointer;' +
            'box-shadow:0 4px 20px rgba(0,0,0,0.22),0 0 0 1px rgba(148,163,184,0.2);' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
            'transform:translate(-50%,-100%);text-align:center;font-weight:600;';
          var t = escapeHtml(title);
          var c =
            count > 1
              ? '<span style="font-size:13px;font-weight:700;margin-top:3px;opacity:0.95;letter-spacing:-0.02em">' +
                count +
                '</span>'
              : '';
          el.innerHTML =
            '<span style="font-size:11px;font-weight:600;opacity:0.88;line-height:1.25">' +
            t +
            '</span>' +
            c;
          return el;
        }

        function makeDotEl() {
          var el = document.createElement('div');
          el.style.cssText =
            'width:12px;height:12px;border-radius:50%;' +
            'background:linear-gradient(160deg,#93c5fd,#3b82f6);' +
            'box-shadow:0 0 0 2px rgba(255,255,255,0.92),0 2px 10px rgba(15,23,42,0.35);cursor:pointer;' +
            'transform:translate(-50%,-50%);';
          return el;
        }

        /** 시트에서 연 명소 — 이름 칩 + 한 개 앵커만 (도트와 pill 이중 표시 방지) */
        function makeFocusedSpotMarkerEl(title) {
          var wrap = document.createElement('div');
          wrap.style.cssText =
            'display:flex;flex-direction:column;align-items:center;' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
            'pointer-events:auto;cursor:pointer;';
          var card = document.createElement('div');
          var safe = escapeHtml(title);
          card.style.cssText =
            'max-width:min(72vw,232px);padding:8px 13px;' +
            'background:rgba(15,23,42,0.94);' +
            'color:#f1f5f9;border-radius:12px;font-size:12px;font-weight:600;line-height:1.35;' +
            'box-shadow:0 8px 28px rgba(0,0,0,0.26),0 0 0 1px rgba(148,163,184,0.22);' +
            'text-align:center;white-space:normal;word-break:keep-all;letter-spacing:-0.02em;';
          card.innerHTML = safe;
          var pin = document.createElement('div');
          pin.style.cssText =
            'width:10px;height:10px;margin-top:5px;border-radius:50%;' +
            'background:linear-gradient(145deg,#60a5fa,#2563eb);' +
            'box-shadow:0 0 0 2.5px rgba(255,255,255,0.96),0 3px 10px rgba(37,99,235,0.35);';
          wrap.appendChild(card);
          wrap.appendChild(pin);
          return wrap;
        }

        function placeOverlay(key, pos, el, onClick, placeOpts) {
          placeOpts = placeOpts || {};
          var yDef = onClick ? 1 : 0.5;
          var yA = typeof placeOpts.yAnchor === 'number' ? placeOpts.yAnchor : yDef;
          var zI = typeof placeOpts.zIndex === 'number' ? placeOpts.zIndex : 6;
          var ov = new kakao.maps.CustomOverlay({
            map: map,
            position: pos,
            content: el,
            yAnchor: yA,
            zIndex: zI,
          });
          if (onClick) el.addEventListener('click', onClick);
          spotMarkers.set(key, ov);
        }

        function centroid(list) {
          var la = 0,
            ln = 0;
          list.forEach(function (s) {
            la += s.lat;
            ln += s.lng;
          });
          var n = list.length || 1;
          return new kakao.maps.LatLng(la / n, ln / n);
        }

        function serializeSpotForRn(s) {
          return {
            id: String(s.id),
            lat: s.lat,
            lng: s.lng,
            title: s.title ? String(s.title) : '',
            shortTitle: s.shortTitle ? String(s.shortTitle) : '',
            regionKey: s.regionKey ? String(s.regionKey) : '',
          };
        }

        function refreshSpotOverlays() {
          clearSpots();
          if (!map || !Array.isArray(allSpotsCache) || !allSpotsCache.length) return;

          var level = map.getLevel();

          if (level >= LEVEL_HIDE_SPOTS) {
            return;
          }

          var spots = allSpotsCache.filter(function (s) {
            return s && s.id && typeof s.lat === 'number' && typeof s.lng === 'number';
          });
          if (!spots.length) return;

          if (level >= LEVEL_PROVINCE_LO) {
            var byRegion = {};
            spots.forEach(function (s) {
              var k = (s.regionKey || '기타').trim();
              if (!byRegion[k]) byRegion[k] = [];
              byRegion[k].push(s);
            });
            Object.keys(byRegion).forEach(function (rk) {
              var list = byRegion[rk];
              var pos = centroid(list);
              var el = makeClusterEl(rk, list.length);
              placeOverlay('p-' + rk, pos, el, function () {
                post({
                  type: 'CLUSTER_SPOTS',
                  data: {
                    kind: 'province',
                    regionKey: rk,
                    spots: list.map(serializeSpotForRn),
                  },
                });
              });
            });
            return;
          }

          if (level >= LEVEL_GRID_LO) {
            var cellDeg = 0.42;
            var buckets = {};
            spots.forEach(function (s) {
              var ix = Math.round(s.lat / cellDeg);
              var iy = Math.round(s.lng / cellDeg);
              var key = ix + 'x' + iy;
              if (!buckets[key]) buckets[key] = [];
              buckets[key].push(s);
            });
            Object.keys(buckets).forEach(function (bk) {
              var list = buckets[bk];
              var pos = centroid(list);
              var label =
                list.length === 1
                  ? (list[0].shortTitle || list[0].title || '명소').slice(0, 14)
                  : list.length + '곳';
              var el = makeClusterEl(label, list.length);
              placeOverlay('g-' + bk, pos, el, function () {
                post({
                  type: 'CLUSTER_SPOTS',
                  data: {
                    kind: 'grid',
                    spots: list.map(serializeSpotForRn),
                  },
                });
              });
            });
            return;
          }

          spots.forEach(function (s) {
            var pos = new kakao.maps.LatLng(s.lat, s.lng);
            var sid = String(s.id);
            var focused =
              mapFocusState &&
              mapFocusState.spotId === sid &&
              mapFocusState.label &&
              String(mapFocusState.label).trim() !== '';

            if (focused) {
              var elF = makeFocusedSpotMarkerEl(String(mapFocusState.label));
              elF.addEventListener('click', function () {
                post({ type: 'MARKER_CLICK', data: { spotId: sid } });
              });
              placeOverlay('s-' + sid, pos, elF, null, { yAnchor: 1, zIndex: 10 });
              return;
            }

            var el = makeDotEl();
            el.addEventListener('click', function () {
              post({ type: 'MARKER_CLICK', data: { spotId: sid } });
            });
            placeOverlay('s-' + sid, pos, el, null);
          });
        }

        function clearMapFocus() {
          mapFocusState = null;
          clearHighlightLabel();
          refreshSpotOverlays();
        }

        function setSpots(spots) {
          allSpotsCache = Array.isArray(spots) ? spots.slice() : [];
          refreshSpotOverlays();
        }

        function clearHighlightLabel() {
          if (highlightOverlay) {
            try {
              highlightOverlay.setMap(null);
            } catch (e) {}
            highlightOverlay = null;
          }
        }

        function showHighlightLabel(lat, lng, labelText) {
          clearHighlightLabel();
          if (!map || !labelText) return;
          var pos = new kakao.maps.LatLng(lat, lng);
          var el = document.createElement('div');
          var safe = escapeHtml(labelText);
          el.style.cssText =
            'max-width:min(88vw,260px);padding:8px 13px;background:rgba(15,23,42,0.94);' +
            'color:#f1f5f9;border-radius:12px;font-size:12px;font-weight:600;line-height:1.35;' +
            'box-shadow:0 8px 28px rgba(0,0,0,0.26),0 0 0 1px rgba(148,163,184,0.22);' +
            'text-align:center;white-space:normal;word-break:keep-all;' +
            'transform:translate(-50%,-100%);margin-top:-14px;' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
            'letter-spacing:-0.02em;';
          el.innerHTML = safe;
          highlightOverlay = new kakao.maps.CustomOverlay({
            map: map,
            position: pos,
            content: el,
            yAnchor: 0,
            zIndex: 12,
          });
        }

        function applyFocusMap(data) {
          if (!map || !data) return;
          if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return;
          var pos = new kakao.maps.LatLng(data.lat, data.lng);
          map.setCenter(pos);
          var lv =
            typeof data.level === 'number' ? data.level : 7;
          lv = Math.max(1, Math.min(14, lv));
          map.setLevel(lv);

          var lb = data.label != null ? String(data.label).trim() : '';
          var sidRaw = data.spotId != null ? String(data.spotId).trim() : '';

          if (sidRaw && lb) {
            clearHighlightLabel();
            mapFocusState = {
              spotId: sidRaw,
              label: lb,
              lat: data.lat,
              lng: data.lng,
            };
          } else {
            mapFocusState = null;
            clearHighlightLabel();
            if (lb.length > 0) {
              showHighlightLabel(data.lat, data.lng, lb);
            }
          }

          refreshSpotOverlays();
        }

        function handleMessage(raw) {
          var msg;
          try {
            msg = JSON.parse(raw);
          } catch (e) {
            return;
          }
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
            case 'FOCUS_MAP':
              applyFocusMap(msg.data || {});
              break;
            case 'CLEAR_MAP_FOCUS':
              clearMapFocus();
              break;
          }
        }

        window.__STAR_CHASER_RN_BRIDGE = function (raw) {
          handleMessage(raw);
        };
        document.addEventListener('message', function (e) {
          handleMessage(e.data);
        });
        window.addEventListener('message', function (e) {
          handleMessage(e.data);
        });

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
