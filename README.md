# ⭐ StarChaser

> "오늘 밤, 별 보러 가도 될까?"

한국 기상청·에어코리아·KASI 공공 데이터 기반 **별 관측 성공 확률(Star-Index)** 특화 앱

---

## 팀

| 역할 | 이름 | 담당 |
|---|---|---|
| A | 장성재 | BE 기반 · Star-Index 알고리즘 · 인증 · Railway 배포 |
| B | 김세희 | FE 리드 · 디자인 시스템 · 지도 · TOP5 · 온보딩 |
| C | 지영재 | DB 설계 · 천문 계산 · 가상 밤하늘 뷰어 · 알림 |

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React Native + Expo (SDK 51+) |
| Backend | NestJS 10.x |
| DB | PostgreSQL 15 + PostGIS (Supabase) |
| 캐시 | NestJS 메모리 캐시 → Phase 2에서 Redis 교체 |
| 배포 | Railway (백엔드) / EAS Build (앱) |
| 지도 | Kakao Map API |

---

## 로컬 개발 환경 세팅

### 사전 설치
- Node.js LTS (v20+)
- Git

### 1. 레포 클론
```bash
git clone https://github.com/[org]/starchaser.git
cd starchaser
```

### 2. 백엔드 세팅
```bash
cd backend
npm install
cp .env.example .env
# .env 파일에 팀 공유 값 입력 (단톡 확인)
npm run start:dev
```

### 3. 프론트엔드 세팅
```bash
cd frontend
npm install
npx expo start
# 폰에 Expo Go 앱 설치 후 QR 스캔
```

---

## 브랜치 전략

```
main        ← 운영용. 직접 push 금지. PR + 리뷰 1명 승인 후 merge
develop     ← 개발 통합 브랜치
feat/기능명 ← 기능 개발 (예: feat/star-index)
fix/버그명  ← 버그 수정 (예: fix/moon-altitude)
chore/작업  ← 설정/문서 변경 (예: chore/env-setup)
```

## 커밋 메시지 규칙

```
feat(star-index): GPS 고도 10번째 변수 가중치 0.06 적용
fix(map): PostGIS 반경 조회 SRID 4326 누락 수정
chore(env): .env.example 변수명 추가
```

---

## ⚠️ Star-Index 적중률 ≥ 75% 달성 전까지 기능 추가 PR 금지
