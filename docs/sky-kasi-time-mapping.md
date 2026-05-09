# Sky · KASI 달 · 시각 정합 (3–4주차 작업 메모)

QA 시 같은 입력으로 필드를 맞추기 위한 매핑표입니다. 자동 검증 스크립트는 후속.

## 0. 천체 에페머리스 (Sky `bodies`)

`GET /sky/view`는 `astronomy-engine`(VSOP·내장 lunar)로 **달·금성·목성**의 지평선 상 방위·고도·가시 등급과, 달의 **위상 비율·MoonPhase(°)** 를 `bodies[]`에 포함한다. Stellarium과 mm 단위로 일치하지는 않을 수 있으나 QA 시 같은 시각·위치로 비교 가능하다.

## 1. 시간대 라벨

| 표면 | 소스 | 비고 |
|------|------|------|
| Sky `POST /sky/view?at=` | ISO8601 UTC (`Z`) | 클라는 **UTC 문자열** 유지, 화면에 KST 병기 권장 |
| 앱 Sky 탭 | `observeAtIso` | 현재: 버튼으로 ±시간은 UTC 기준 |
| KASI RiseSet / LunPh | `locdate` 등 **로컬 날짜 문자열** | `SkyService.getMoonData`가 `YYYYMMDD`로 호출 |

## 2. 달 필드 (Star-Index vs 원본)

| 필드 | `GET /sky/moon` | Cron moon 캐시 → Star-Index `weather_snapshot` | 비고 |
|------|-----------------|-----------------------------------------------|------|
| 고도 | `moonAltitude`, `moonAltitudeKnown` | `moon_altitude_deg`, `moonAltitudeKnown` | 고도 미확정 시 센티넬 `-10` 등 — [`week3-moon-stellarium-check.md`](./week3-moon-stellarium-check.md) |
| 위상 | `lunPhase` 등 | `lun_phase` 등 | 날짜 키 `moon:${today}` — 과거 `sky/moon?date=` 과 즉시 1:1 아님 |

## 3. 회귀 체크리스트 (수동)

1. 센티넬 달: `moonAltitudeKnown=false`일 때 Star-Index 달 감점 정책이 기획과 일치하는지.
2. Sky `at` UTC 변경 시 `lstDeg`·가시 별 수 변화 (Stellarium 대비 각도 기록은 QA 시트).
3. `GET /cron/run-once` 후 Star-Index 캐시 갱신 여부.

## 4. 후속

- 이 문서에 Swagger 필드 ↔ 앱 표시 한 줄 표 추가.
- Stellarium 스냅샷 대비 허용 오차 합의 후 Phase 1 QA 항목에 고정.
