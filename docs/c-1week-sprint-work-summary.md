# C 담당 작업 종합 정리

## 한 줄 요약
DB/시딩 보강, 알림 백엔드 기반(토큰/설정 API), KASI/Stellarium 검증 문서화를 완료했다.

## 완료한 작업

### 1) 알림 백엔드 기반 구축
- FCM 토큰 등록/비활성화 API 구현
  - `POST /notifications/token`
  - `DELETE /notifications/token`
- 알림 설정 조회/저장 API 구현
  - `GET /notifications/preferences`
  - `PUT /notifications/preferences`
- 관련 DB 구조 추가
  - `notification_tokens`
  - `notification_preferences`
- 마이그레이션 반영 및 Swagger 동작 확인(200 응답)

### 2) 명소 시딩 확대
- 기존 수작업 검증 5개 유지
- 추가 명소 데이터를 보강해 총 50개 기준 시드 구성
- `elevationM` 누락 없이 반영
- 시드 실행 및 조회/검색 API 검증 완료

### 3) KASI/천문 데이터 검증 지원
- `moonAltitudeKnown`/센티넬(-10) 케이스 확인
- Stellarium 3케이스 스냅샷 기반 교차검증 문서화
- 팀 합의 필요사항(센티넬 처리, 지표 정의 차이) 정리

## 핵심 산출물
- `backend/src/migrations/1714536000000-add-notification-tokens-and-preferences.ts`
- `backend/src/notifications/` (controller/service/repository/entity/dto)
- `backend/src/seeds/spots.seed.ts`
- `docs/week3-search-validation.md`
- `docs/week3-moon-stellarium-check.md`

## 검증 체크 결과
- 알림 API: 토큰 등록/비활성화, 설정 조회/저장 정상
- 시딩: `npm run seed` 실행 성공, `elevation_m null` 0건
- 검색: 핵심 키워드(인제, 별마로) 응답 확인
- 달 데이터: 센티넬 케이스 및 크로스체크 결과 문서화

## 팀 합의 필요사항
- 센티넬(-10) 발생 시 달 감점 정책(유지 vs 보수 적용)
- `moon_altitude_known=false` 상태 안내 문구 노출 여부
- 위상 지표 정의 통일(주기 진행률 vs 조도 비율)

## 보류/다음 작업
- FCM 실발송 로직 연결
- 이벤트 조건 기반 스케줄러 실동작
  - Star-Index 70+
  - 유성우/천체 이벤트
  - TOP5 갱신
- FE 온보딩 토글과 알림 설정 최종 연동

## 메모
- 시딩 데이터는 수작업 검수 기준으로 유지·보정
