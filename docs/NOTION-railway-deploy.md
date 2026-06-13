# StarChaser Railway 백엔드 배포 가이드 (노션·운영 참조용)

> **대상**: NestJS API (`backend/`)  
> **목적**: 프로덕션 API URL 확보 → Expo 앱 `EXPO_PUBLIC_API_URL` · Play 방침 URL `/privacy`  
> **최종 업데이트**: 2026-06-03

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [Railway 프로젝트 생성](#2-railway-프로젝트-생성)
3. [서비스 설정 (빌드·시작 명령)](#3-서비스-설정-빌드시작-명령)
4. [환경 변수 전체 목록](#4-환경-변수-전체-목록)
5. [Redis 추가 (권장)](#5-redis-추가-권장)
6. [커스텀 도메인 (선택)](#6-커스텀-도메인-선택)
7. [배포 후 검증](#7-배포-후-검증)
8. [앱·Play 연동](#8-앱play-연동)
9. [재배포·롤백](#9-재배포롤백)
10. [자주 나는 오류](#10-자주-나는-오류)

---

## 1. 사전 준비

### 1.1 계정·권한

| 항목 | 필요 |
|------|------|
| [Railway](https://railway.app) 계정 | GitHub 연동 권장 |
| GitHub `starchaser` 레포 push 권한 | 자동 배포용 |
| Supabase 프로젝트 | `DATABASE_URL` |
| 공공 API 키 | KMA, 에어코리아, KASI |
| Firebase 프로젝트 | FCM 서비스 계정 JSON → env 3종 |
| (권장) Redis | Railway Redis 플러그인 |

### 1.2 로컬에서 한 번 확인

```powershell
cd backend
npm install
npm run build
npm run start:prod
```

- `http://127.0.0.1:3333` (또는 `.env`의 `PORT`) 응답 확인
- 로컬 `.env`는 **Railway에 올리지 말 것** — Variables에 키별로 입력

### 1.3 레포 구조 (Railway가 빌드하는 위치)

```text
starchaser/
  backend/          ← Root Directory 로 지정
    package.json
    src/
    legal-pages/    ← /privacy, /terms HTML (배포 시 포함)
    nest-cli.json
  frontend/         ← Railway 서비스와 별도 (EAS Build)
```

---

## 2. Railway 프로젝트 생성

### 2.1 새 프로젝트

1. [Railway Dashboard](https://railway.app/dashboard) → **New Project**
2. **Deploy from GitHub repo** 선택
3. `starchaser` 레포 연결 (처음이면 GitHub 앱 권한 승인)
4. 프로젝트 이름 예: `starchaser-api`

### 2.2 서비스가 자동 생성되면

- 루트에 `Dockerfile`이 없으면 **Nixpacks**가 Node 프로젝트를 감지합니다.
- **반드시** 서비스 설정에서 **Root Directory**를 `backend`로 바꿉니다. (아래 3절)

---

## 3. 서비스 설정 (빌드·시작 명령)

서비스 카드 클릭 → **Settings** 탭.

### 3.1 Root Directory (필수)

| 필드 | 값 |
|------|-----|
| **Root Directory** | `backend` |

레포 루트가 아닌 `backend`에서 `npm install` / `npm run build` 가 실행됩니다.

### 3.2 Build & Deploy

Railway UI 버전에 따라 **Build** / **Deploy** 섹션이 나뉩니다.

| 필드 | 권장 값 | 설명 |
|------|---------|------|
| **Build Command** | `npm run build` | `nest build` → `dist/` 생성 |
| **Start Command** | `npm run start:prod` | `node dist/main` |

`package.json` 참고:

```json
"build": "nest build",
"start:prod": "node dist/main"
```

### 3.3 Watch paths (선택)

- `backend/**` 만 감시하도록 설정 가능 (모노레포일 때 frontend 변경에 재배포 방지)

### 3.4 Healthcheck (선택)

- Path: `/` 또는 공개 GET (예: `/privacy`)
- Railway가 배포 성공 여부 판단에 사용

### 3.5 Networking

- **Generate Domain** 클릭 → `*.up.railway.app` URL 발급
- 이 URL이 **API 베이스**가 됩니다. 예:  
  `https://starchaser-production.up.railway.app`

---

## 4. 환경 변수 전체 목록

서비스 → **Variables** 탭 → **RAW Editor**로 한 번에 붙여넣기 가능.

> ⚠️ 값은 팀 보안 채널에서만 공유. 노션·Git에 실제 키 붙이지 마세요.

### 4.1 필수 (없으면 기동 실패 또는 핵심 기능 불가)

```env
NODE_ENV=production

DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres

JWT_SECRET=<32자 이상 랜덤, openssl rand -hex 32>
JWT_REFRESH_SECRET=<JWT_SECRET과 다른 32자+ 랜덤>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>

KMA_API_KEY=<기상청 API>
AIRKOREA_API_KEY=<에어코리아 API>
KASI_API_KEY=<KASI API>

ADMIN_EMAILS=admin@yourteam.com
```

### 4.2 FCM 푸시 (알림 사용 시)

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

- Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 JSON
- `private_key`의 줄바꿈을 `\n`으로 이어 붙인 **한 줄** 문자열

### 4.3 SMTP (회원가입·비밀번호 재설정 메일)

미설정 시 인증번호가 **서버 로그에만** 출력됩니다 (프로덕션에서는 반드시 설정).

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=<Gmail 앱 비밀번호>
SMTP_FROM=StarChaser <no-reply@starchaser.app>
```

### 4.4 캐시·성능 (MAIN 로딩 개선, 권장)

```env
CACHE_DRIVER=redis
REDIS_URL=${{Redis.REDIS_URL}}
```

- `REDIS_URL`은 Railway Redis 플러그인 추가 시 **Variable Reference**로 연결 (5절)
- Redis 없이 배포하려면:

```env
CACHE_DRIVER=memory
STAR_INDEX_WARM_ON_STARTUP=true
```

(재시작 시 캐시 비움 — 단일 인스턴스·테스트용)

### 4.5 선택

```env
PORT=3333
HOST=0.0.0.0
STAR_INDEX_WARM_ON_STARTUP=true
KAKAO_REST_API_KEY=
KAKAO_JS_KEY=
CACHE_TTL=3600
```

Railway는 보통 `PORT`를 자동 주입합니다. `HOST=0.0.0.0` 은 프로덕션 리슨용(코드 기본값과 동일).

### 4.6 프로덕션에서 끌 플래그 (기본 off)

```env
# FCM_TEST_SEND_ENABLED=false
# FCM_SCHEDULED_TOP3_PUSH_ENABLED=false
# FCM_SCHEDULED_STAR_INDEX_PUSH_ENABLED=false
```

개발용 수동 푸시는 production에서 env 없으면 차단됩니다.

### 4.7 Variables 체크리스트

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` ≠ `JWT_REFRESH_SECRET`
- [ ] `DATABASE_URL` SSL Supabase URL
- [ ] `ADMIN_EMAILS`에 실제 관리자 이메일
- [ ] Redis 사용 시 `CACHE_DRIVER=redis` + `REDIS_URL`

---

## 5. Redis 추가 (권장)

### 5.1 플러그인 추가

1. 프로젝트 화면 → **+ New** → **Database** → **Redis**
2. Redis 서비스 생성 대기

### 5.2 API 서비스와 연결

1. **API 서비스** → Variables
2. `REDIS_URL` = `${{Redis.REDIS_URL}}`  
   (UI에서 **Add Reference** → Redis 서비스의 `REDIS_URL` 선택)
3. `CACHE_DRIVER=redis`

### 5.3 동작

- 서버 재시작 후에도 weather/dust/moon 캐시 유지
- `STAR_INDEX_WARM_ON_STARTUP=true` 이면 기동 시 백그라운드 워밍

---

## 6. 커스텀 도메인 (선택)

### 6.1 API용 서브도메인 (예: api.starchaser.app)

1. API 서비스 → **Settings** → **Networking** → **Custom Domain**
2. `api.starchaser.app` 입력
3. Railway가 안내하는 **CNAME**을 DNS(Cloudflare 등)에 추가
4. SSL은 Railway가 자동 발급

앱 env:

```env
EXPO_PUBLIC_API_URL=https://api.starchaser.app
```

Play 방침 URL:

```text
https://api.starchaser.app/privacy
```

### 6.2 CORS

프로덕션 CORS는 `https://starchaser.app` 만 허용 (`backend/src/main.ts`).  
웹/admin을 다른 origin에서 쓰면 해당 origin 추가 필요.

---

## 7. 배포 후 검증

### 7.1 배포 로그

Deployments → 최신 배포 → **View Logs**

성공 시 예:

```text
🚀 StarChaser API on http://0.0.0.0:PORT
[CacheWarm] 기동 워밍 시작
```

실패 시:

- `JWT_SECRET` / `DATABASE_URL` 누락
- `npm run build` 실패 → 로컬에서 동일 브랜치 빌드 확인

### 7.2 공개 URL 스모크 (브라우저·curl)

`BASE=https://YOUR.up.railway.app` 로 교체.

| # | 요청 | 기대 |
|---|------|------|
| 1 | `GET BASE/privacy` | 200, HTML 개인정보 처리방침 |
| 2 | `GET BASE/terms` | 200, HTML 이용약관 |
| 3 | `POST BASE/auth/login` | 401 또는 400 (형식만 확인) |

PowerShell 예:

```powershell
$base = "https://YOUR.up.railway.app"
Invoke-WebRequest "$base/privacy" -UseBasicParsing | Select-Object StatusCode
```

### 7.3 DB 마이그레이션

Railway는 **자동 마이그레이션하지 않습니다.** Supabase에 스키마가 이미 적용돼 있어야 합니다.

로컬에서 프로덕션 DB에 대해 (주의: 팀 합의 후):

```powershell
cd backend
# DATABASE_URL을 프로덕션으로 잠시 설정한 뒤
npm run migration:run
```

일반적으로는 **스테이징/프로덕션 Supabase를 분리**하고, 배포 전 스테이징에서 migration 검증합니다.

### 7.4 인증·Star-Index (앱 또는 curl)

1. 앱 `EXPO_PUBLIC_API_URL` = Railway URL
2. 회원가입 → 인증 메일 수신 (SMTP)
3. 로그인 → MAIN Star-Index 로딩

### 7.5 Redis·워밍 확인

로그에서:

```text
캐시 드라이버: redis (...)
[CacheWarm] 기동 워밍 종료
```

재배포 직후 앱 MAIN이 이전보다 빨라지는지 체감 확인.

---

## 8. 앱·Play 연동

### 8.1 Expo / EAS

`frontend` 빌드 시:

```env
EXPO_PUBLIC_API_URL=https://YOUR.up.railway.app
```

- EAS Secrets에 동일 값 등록
- production 프로필로 AAB 빌드

### 8.2 Play Console URL

| 항목 | URL |
|------|-----|
| 개인정보 처리방침 | `https://YOUR.up.railway.app/privacy` |
| 계정 삭제 안내 문구 | 앱 내: 마이페이지 → 계정 → 회원 탈퇴 |

`frontend/content/legal-documents.ts` 의 `PRIVACY_POLICY_PUBLIC_URL` 과 **완전히 동일**하게.

### 8.3 legal HTML 수정 시

1. `docs/legal/privacy.html` 수정
2. `backend/legal-pages/privacy.html` 에 복사
3. git push → Railway 자동 재배포

---

## 9. 재배포·롤백

### 9.1 자동 배포

- `main`(또는 연결 브랜치) push → Railway가 빌드·배포
- PR 미리보기는 Railway 플랜/설정에 따름

### 9.2 수동 재배포

Deployments → **Redeploy**

### 9.3 롤백

Deployments → 이전 성공 배포 → **Rollback**

### 9.4 환경 변수만 변경

Variables 저장 → 서비스 **Restart** (재배포 없이 반영되는 경우도 있으나 Restart 권장)

---

## 10. 자주 나는 오류

| 증상 | 원인 | 해결 |
|------|------|------|
| Build failed `nest: not found` | Root Directory가 루트 | `backend` 로 설정 |
| Application failed to respond | `HOST` 127.0.0.1 | `NODE_ENV=production` → 0.0.0.0 리슨 |
| JWT / DB error on start | Variables 누락 | 4절 체크리스트 |
| 503 Star-Index | API 키·캐시 cold | KMA/AIRKOREA 키, Redis+워밍 |
| CORS error (웹만) | origin 불일치 | `main.ts` CORS origin 추가 |
| `/privacy` 500 | `legal-pages/` 미포함 | `backend/legal-pages` 파일 존재·커밋 확인 |
| 인증 메일 안 옴 | SMTP 미설정 | SMTP_* Variables |
| Redis connection refused | `REDIS_URL` 잘못됨 | Reference `${{Redis.REDIS_URL}}` |

---

## 부록 A — Railway 서비스 설정 요약 카드 (노션에 붙여넣기용)

```text
┌─────────────────────────────────────────┐
│ StarChaser API (Railway)                │
├─────────────────────────────────────────┤
│ Root Directory: backend                 │
│ Build:  npm run build                   │
│ Start:  npm run start:prod              │
│ Domain: https://________.up.railway.app │
├─────────────────────────────────────────┤
│ NODE_ENV=production                     │
│ CACHE_DRIVER=redis + REDIS_URL (권장)   │
│ STAR_INDEX_WARM_ON_STARTUP=true         │
├─────────────────────────────────────────┤
│ Play URL: .../privacy                   │
│ App: EXPO_PUBLIC_API_URL=동일 호스트    │
│ Support: support@starchaser.app (DNS)   │
└─────────────────────────────────────────┘
```

---

## 부록 B — 관련 문서

| 문서 | 내용 |
|------|------|
| `docs/NOTION-legal-play-email.md` | 방침 HTML, Play URL, support 메일 |
| `docs/DEPLOY.md` | 짧은 배포 체크리스트 |
| `backend/.env.example` | 변수 전체 주석 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-03 | 최초 작성 — `/privacy`·`/terms` API 서빙, Redis·Variables 상세 |
