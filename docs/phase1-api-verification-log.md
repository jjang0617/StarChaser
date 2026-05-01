# Phase 1 API 수동 검증 로그

**일시:** 2026-05-01 (로컬)  
**환경:** `backend` `.env` 존재, `npm run start:dev`, `http://127.0.0.1:3333`

## 1. DB 마이그레이션

- **명령:** `npm run migration:run`
- **결과:** `AddStarIndexCorrectionSubmissions1719000000000` 적용 성공 (`star_index_correction_submissions` 생성).

## 2. HTTP 시나리오 (JWT)

| 순서 | 요청 | 결과 |
|------|------|------|
| 1 | `POST /auth/register` (임시 이메일) | 200, accessToken 수신 |
| 2 | `GET /spots` (Bearer) | 명소 목록, 첫 `spotId` 사용 |
| 3 | `POST /cron/run-once` (Bearer) | 200, 수집 완료 메시지 |
| 4 | `GET /star-index?spotId={uuid}` (Bearer) | 200, `score` 예: 57 |
| 5 | `GET /sky/view?lat=37.2&lng=128.5` (Bearer) | 200, `lstDeg`·가시 별 수(예: 22) |
| 6 | `POST /corrections` `{ spotId, perceivedQuality: 72 }` (Bearer) | 200, `aggregatedCorrectionScore` 72 |

**샘플 spotId (해당 DB 기준):** `ddb2aa91-9ac1-4ee7-864f-ff94ab76c002`  
**샘플 테스트 계정:** 일회용 `e2e_*@test.local` (로컬 검증용, 커밋하지 않음)

## 3. 재실행 방법

```powershell
cd backend
npm run migration:show
npm run start:dev
# 다른 터미널에서 Swagger 또는 Invoke-RestMethod로 위 시나리오 반복
```

---

*자동 에이전트가 생성한 검증 기록입니다. CI에 통합하려면 e2e 스크립트로 옮기면 됩니다.*
