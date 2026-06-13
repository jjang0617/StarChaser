# Map 탭 — KakaoMapWebView 메시지 규격

React Native(앱)와 WebView 안의 `kakao.html`(카카오맵 JS) 사이 데이터 교환 규격이다. **A(백엔드/데이터)·B(FE 지도)** 가 같은 타입 문자열을 쓰도록 맞춘다.

## 구현 위치

| 역할                | 파일                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| RN 타입·RN→Web 전송 | `frontend/components/map/KakaoMapWebView.tsx` (`RNToWebMessage`, `injectWebMessage`) |
| spots 조회·DTO 매핑 | `frontend/lib/spots-api.ts` (`spotDtoToMapSpot`, `fetchSpotsAll` / `fetchSpotsNearby`) |
| 지도 마커 좌표 타입 | `frontend/lib/types/map-spot.ts` (`MapSpot`, `LatLng`)                               |
| Web 수신·지도 반영  | `map-site/kakao.html` (`handleMessage` 스위치). GitHub Pages 배포본이 WebView에서 로드된다. |
| Web→RN 전송         | `kakao.html` 내 `post()` → `window.ReactNativeWebView.postMessage`                   |

## 공통 규칙

- 한 메시지 = **JSON 문자열 한 덩어리** (객체 직렬화).
- 필수 필드: **`type`** (대문자 스네이크/고정 문자열).
- 페이로드는 가능하면 **`data`** 키 아래에만 둔다.

---

## Web → RN (지도 페이지 → 앱)

Web에서 `JSON.stringify` 후 `ReactNativeWebView.postMessage`로 보낸다. RN은 `WebView`의 `onMessage`에서 `JSON.parse`한다.

| `type`         | `data`               | 언제                                                                    |
| -------------- | -------------------- | ----------------------------------------------------------------------- |
| `MAP_READY`    | 없음                 | 카카오맵 생성 직후 1회. RN은 이 시점 이후 `SET_*` 전송을 시작해도 된다. |
| `MARKER_CLICK` | `{ spotId: string }` | 명소 라벨(오버레이) 탭 시.                                              |
| `VIIRS_LAYER_READY` | (선택) `{ mapTypeId?: string, enabled?: boolean, ... }` | `SET_VIIRS_LAYER` 적용 결과(성공/비활성) |
| `VIIRS_LAYER_ERROR` | (선택) `{ message?: string }` | 템플릿 누락, Tileset 등록/오버레이 실패 등 |

### 예시

```json
{ "type": "MAP_READY" }
```

```json
{ "type": "MARKER_CLICK", "data": { "spotId": "yeongwol-byeolmaro" } }
```

---

## RN → Web (앱 → 지도 페이지)

호스팅 URL을 쓸 때는 RN이 **`injectJavaScript`** 로 `MessageEvent('message', { data })`를 흘려 `kakao.html`의 `handleMessage`와 동일 경로로 태운다.

| `type`                   | `data`                                             | 설명                                                          |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
| `INIT`                   | `{ center?: { lat, lng }, level?: number }` (선택) | 지도 중심·레벨 재설정. 현재 앱 플로우에서는 거의 안 씀.       |
| `SET_CURRENT_LOCATION`   | `{ lat: number, lng: number }`                     | 내 위치 마커 + 지도 중심 이동. 갱신마다내도 된다.             |
| `CLEAR_CURRENT_LOCATION` | 없음                                               | 내 위치 마커만 제거(언마운트 등).                             |
| `SET_SPOTS`              | `Array<{ id, lat, lng, title? }>`                  | 명소 목록 **전체 교체**. 이전 오버레이는 비운 뒤 다시 그린다. |
| `SET_VIIRS_LAYER`        | `{ enabled: boolean, tileUrlTemplate?: string, minZoom?: number, maxZoom?: number, opacity?: number, darkTiles?: boolean, copyrightMsg?: string, copyrightShortMsg?: string }` | `enabled:true`일 때 `tileUrlTemplate` 필수. NASA GIBS WMTS(REST) 등 `{z}/{y}/{x}` 템플릿 |

#### NASA GIBS WMTS(REST) 템플릿 주의

GIBS의 REST 경로가 `.../{TileMatrix}/{TileRow}/{TileCol}.png` 형태인 경우가 많습니다. Kakao `Tileset.urlFunc(x, y, z)`는 XYZ의 **column/row/level**처럼 동작하므로 보통 다음 매핑이 맞는 경우가 많습니다.

- `{z}` ← `TileMatrix`
- `{y}` ← `TileRow`
- `{x}` ← `TileCol`

앱(`KakaoMapWebView`)은 기본 GIBS URL을 만들 때도 위 **`{z}/{y}/{x}`** 순서를 쓴다. MAP 탭의 **광공해 보기/끄기** 버튼으로 레이어 켜짐만 제어한다(환경 변수 없음).

### `MapSpot` (SET_SPOTS 한 줄 요약)

- `id`: 문자열, 고유 식별자 (API `spotId` 등과 매핑 예정).
- `lat`, `lng`: WGS84 도 단위.
- `title`: 선택. 라벨에 표시(HTML 이스케이프 처리됨).

### 백엔드 `SpotDto` → `MapSpot` (앱 `spotDtoToMapSpot`)

`GET /spots`, `GET /spots/nearby` 응답 한 건(`SpotDto`)을 지도로 보낼 때 아래처럼 맞춘다.

| SpotDto (API) | MapSpot (SET_SPOTS) |
| --------------- | --------------------- |
| `id` | `id` |
| `name` | `title` |
| `lat` | `lat` |
| `lng` | `lng` |

나머지 필드(`bortleClass`, `elevationM`, `hasParking`, `hasToilet`, `locationRadiusM` 등)는 현재 Web 라벨에 쓰지 않아 `SET_SPOTS` 페이로드에 넣지 않는다. 필요 시 확장 시 문서·`kakao.html` 같이 갱신.

### 앱에서 `SET_SPOTS`를 채우는 방식 (`KakaoMapWebView` `spotListMode`)

| 모드 | 데이터 소스 |
| ---- | ----------- |
| `nearby` (기본) | 첫 GPS(또는 위치 권한 후 1회 좌표)로 `GET /spots/nearby` → `SET_SPOTS`. 10초 안에 좌표를 못 받으면 `GET /spots`로 폴백 후 `SET_SPOTS`. |
| `all` | `GET /spots` → `SET_SPOTS`. |

### 예시

```json
{ "type": "SET_CURRENT_LOCATION", "data": { "lat": 37.5665, "lng": 126.978 } }
```

```json
{
  "type": "SET_SPOTS",
  "data": [
    { "id": "1", "lat": 37.1865, "lng": 128.471, "title": "영월 별마로천문대" }
  ]
}
```

```json
{ "type": "CLEAR_CURRENT_LOCATION" }
```

```json
{
  "type": "SET_VIIRS_LAYER",
  "data": {
    "enabled": true,
    "tileUrlTemplate": "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_DayNightBand_AtSensor_M15/default/2026-04-30/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    "minZoom": 1,
    "maxZoom": 8,
    "opacity": 0.75,
    "darkTiles": false,
    "copyrightMsg": "NASA GIBS / VIIRS",
    "copyrightShortMsg": "VIIRS"
  }
}
```

---

## 확장 시 (팀 합의 후 추가)

새 `type`을 넣을 때는 **양쪽**(TS 타입 + `kakao.html` 스위치)에 같이 반영하고, 이 문서에 한 줄 추가한다.

---

## 참고

개발가이드에서는 **`MAP_READY`**, **`SET_CURRENT_LOCATION`**, **`SET_SPOTS`**, **`MARKER_CLICK`**만 언급했지만, 운영 편의를 위해 코드에 있는 **`CLEAR_CURRENT_LOCATION`**, **`INIT`** 도 같은 규격으로 문서화해 두었다.
