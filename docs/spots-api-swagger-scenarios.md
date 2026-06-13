# Spots API — Swagger 수동 시나리오 (3건)

모든 엔드포인트는 **JWT Bearer**가 필요합니다. Swagger 상단 **Authorize**에 `accessToken`을 넣은 뒤 아래 순서로 호출합니다.

시드 데이터 기준 좌표·이름은 `backend/src/seeds/spots.seed.ts`와 동일합니다.

---

## 시나리오 1 — 전체 목록 (`GET /spots`)

| 단계 | 내용 |
|------|------|
| 목적 | DB에 시드된 명소가 배열로 내려오는지 확인 |
| 요청 | `GET /spots` (쿼리 없음) |
| 기대 | `200`, JSON 배열. `name`, `lat`, `lng`, `bortleClass` 등 필드 포함. 시드 후 `영월 별마로 천문대` 등이 포함될 수 있음 |

---

## 시나리오 2 — 반경 검색 (`GET /spots/nearby`)

| 단계 | 내용 |
|------|------|
| 목적 | 위치·반경(m)으로 ST_DWithin 조회가 되는지 확인 |
| 요청 | `GET /spots/nearby?lat=37.1984&lng=128.4870&radiusM=50000` |
| 설명 | `lat`/`lng`: WGS84. `radiusM`: 미터(예: 50km). 영월 별마로 시드 좌표 근처 |
| 기대 | `200`, 배열에 `영월 별마로 천문대`가 포함되거나, 반경 안에 있는 다른 시드 명소만 반환 |

---

## 시나리오 3 — 키워드 검색 (`GET /spots/search`)

| 단계 | 내용 |
|------|------|
| 목적 | `q` 키워드로 하이브리드 검색(tsvector / pg_trgm / ILIKE) 동작 확인 |
| 요청 | `GET /spots/search?q=영월&limit=10` |
| 설명 | `q`: 검색어. `limit`: 최대 개수(기본 20) |
| 기대 | `200`, 이름에 `영월`이 포함된 명소가 상위에 오거나, 빈 배열이면 시드·DB 상태 확인 |
