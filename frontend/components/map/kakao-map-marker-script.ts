/**
 * Kakao WebView 내 커스텀 오버레이 DOM — Figma MapMarker 스타일
 * `kakao-map-inline-html.ts` · `map-site/kakao.html` 양쪽에 동일 삽입
 */
export const KAKAO_MAP_MARKER_SCRIPT = `
        var SC = {
          deepNavy: 'rgba(7,17,31,0.92)',
          glow: '#8DDCFF',
          glowSoft: 'rgba(141,220,255,0.3)',
          glowFill: 'rgba(141,220,255,0.95)',
          fg: '#F8FAFC',
          border: 'rgba(255,255,255,0.1)',
        };

        function mapPinSvg(stroke) {
          return (
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' +
            stroke +
            '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>' +
            '<circle cx="12" cy="10" r="3"/>' +
            '</svg>'
          );
        }

        function starSvg(fill, stroke) {
          return (
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="' +
            fill +
            '" stroke="' +
            stroke +
            '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
            '</svg>'
          );
        }

        /** Figma cluster — MapPin + 개수 pill */
        function makeClusterEl(count, active) {
          var el = document.createElement('div');
          var isOn = !!active;
          var bg = isOn ? SC.glowFill : SC.deepNavy;
          var border = isOn ? 'rgba(234,246,255,0.55)' : SC.border;
          var iconColor = isOn ? SC.deepNavy.replace('0.92', '1') : SC.glow;
          var textColor = isOn ? SC.deepNavy.replace('0.92', '1') : SC.fg;
          el.style.cssText =
            'display:flex;align-items:center;gap:6px;padding:6px 12px;' +
            'border-radius:999px;background:' +
            bg +
            ';border:1px solid ' +
            border +
            ';cursor:pointer;transform:translate(-50%,-100%);' +
            'box-shadow:0 4px 18px rgba(0,0,0,0.32)' +
            (isOn ? ',0 0 18px rgba(141,220,255,0.45)' : ',0 0 10px rgba(141,220,255,0.12)') +
            ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
          el.innerHTML =
            mapPinSvg(iconColor) +
            '<span style="font-size:12px;font-weight:600;color:' +
            textColor +
            ';letter-spacing:-0.02em">' +
            String(count) +
            '</span>';
          return el;
        }

        /** 별 핀 아래에 붙는 명소 이름 라벨 (핀 위치는 그대로 유지) */
        function appendStarPinLabel(wrap, labelText) {
          if (!labelText) return;
          var lb = document.createElement('div');
          lb.textContent = String(labelText);
          lb.style.cssText =
            'position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:1px;' +
            'white-space:nowrap;max-width:128px;overflow:hidden;text-overflow:ellipsis;' +
            'padding:2px 7px;border-radius:8px;background:rgba(7,17,31,0.82);' +
            'color:#EAF6FF;font-size:11px;font-weight:600;line-height:1.3;' +
            'letter-spacing:-0.02em;pointer-events:none;' +
            'box-shadow:0 2px 8px rgba(0,0,0,0.3),0 0 0 1px rgba(141,220,255,0.18);' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
          wrap.appendChild(lb);
        }

        /** Figma single — 별 핀 (labelText 있으면 핀 아래 이름 표시) */
        function makeStarPinEl(active, labelText) {
          var wrap = document.createElement('div');
          var isOn = !!active;
          var bg = isOn ? SC.glow : SC.deepNavy;
          var border = isOn ? '#EAF6FF' : 'rgba(141,220,255,0.5)';
          var starColor = isOn ? SC.deepNavy.replace('0.92', '1') : SC.glow;
          var shadow = isOn
            ? '0 0 20px rgba(141,220,255,0.75)'
            : '0 0 10px rgba(141,220,255,0.28)';
          wrap.style.cssText =
            'position:relative;display:flex;align-items:center;justify-content:center;' +
            'width:40px;height:44px;cursor:pointer;transform:translate(-50%,-100%);';
          wrap.innerHTML =
            '<div style="width:36px;height:36px;border-radius:50%;background:' +
            bg +
            ';border:1.5px solid ' +
            border +
            ';box-shadow:' +
            shadow +
            ';display:flex;align-items:center;justify-content:center;">' +
            starSvg(starColor, starColor) +
            '</div>';
          appendStarPinLabel(wrap, labelText);
          return wrap;
        }

        /** 시트·탭 포커스 — Figma 활성 별 핀만 (지도에 이름 칩 없음) */
        function makeFocusedSpotMarkerEl() {
          return makeStarPinEl(true);
        }
`;
