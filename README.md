# ⭐ StarChaser (스타체이서)

> **"오늘 밤, 별 보러 가도 될까?"**  
> 한국 기상청 · 에어코리아 · 한국천문연구원(KASI) 공공 데이터와 천문학 알고리즘을 결합하여 실시간 별 관측 성공 확률(**Star-Index**)을 제공하는 서비스입니다.

---

## 🌌 주요 기능 (Key Features)

### 1. 실시간 Star-Index 측정 ( Circular Gauge & 2x3 Stats Grid )
* **실시간 관측 지수 분석**: 기온, 습도, 풍속, 하늘 상태(구름), 미세먼지(PM2.5), 초미세먼지(PM10), 광공해(Bortle Class), 태양 고도(박명 단계), 달 고도 및 위상 등 총 10가지 관측 변수를 가중치 분석 알고리즘으로 계산합니다.
* **인터랙티브 디자인**: 
  * 메인 화면의 반투명 글래스모피즘(Glassmorphism) 서클 게이지가 성공 확률을 시각화합니다. 게이지 내부의 **"탭하여 갱신"** 버튼으로 실시간 데이터를 즉시 갱신할 수 있습니다.
  * 하단 **2x3 그리드 레이아웃**을 통해 핵심 6대 지표(태양고도, 빛공해, 구름, 달고도, 습도, 미세먼지)를 정렬하여 보여줍니다.
  * 각 지표를 탭하면 자세한 설명(천문박명 시간대, 보틀 클래스 정의, 미세먼지 농도 기준 등)이 담긴 **상세 가이드 시트**가 노출됩니다.

### 2. 카카오맵 기반 별 관측 명소 탐색 (Explore Map)
* **클러스터링 및 맞춤 마커**: 전국 별 관측 명소의 실시간 Star-Index 정보를 카카오맵 웹뷰에 핀 형태로 표시합니다.
* **명소 상세 편의 시설 정보**: 각 명소 카드 하단에 고도 정보(`▲ 390m` 등)와 함께, 해당 명소의 **주차 가능 여부(`주차 O`/`주차 X`)**와 **화장실 구비 여부(`화장실 O`/`화장실 X`)**를 뱃지로 상시 노출합니다. (야간 모드 적용 시에는 눈부심 방지를 위해 붉은색 뱃지로 자동 전환됩니다.)

### 3. 관측 일기 (내 기록 & 불일치 제보)
* **모바일 관측 기록**: 관측 당일 찍은 사진(최대 10장, Supabase Storage 연동)과 일기 내용, 본인이 실제 체감한 점수를 입력하여 기록으로 남길 수 있습니다.
* **기록의 다중 계정 보호**: 동일한 단말기에서 로그아웃 후 다른 계정으로 접속하더라도 이전 로그인 계정의 일기 목록이나 마이페이지 정보(프로필, 알림 설정, 내 명소)가 남아있지 않도록 사용자 ID(`user.id`) 단위의 상태 해제 및 데이터 격리 가드를 적용했습니다.
* **Star-Index 보정 제보**: 시스템이 계산한 점수와 현장 체감 점수가 크게 다를 경우, 현장 관측 기록(성공/부분성공/실패)을 제보하여 알고리즘 정확도를 보정하는 피드백 데이터를 적재합니다.

### 4. 가상 스카이 뷰어 (Virtual Sky Viewer)
* **실시간 성도 렌더링**: `react-native-svg` 기술을 활용하여 사용자가 서 있는 위치와 시간에 맞는 별자리와 실시간 가상 밤하늘 지도를 스마트폰 화면에 벡터 그래픽(SVG)으로 가볍고 정밀하게 시뮬레이션 렌더링합니다.
* **별자리 정보 및 신화/이야기**: 화면에 표시된 별이나 별자리를 터치하면 해당 천체의 상세한 과학적 데이터 및 그리스 신화 등 흥미로운 이야기를 카드 형태 오버레이로 제공합니다.

### 5. 실시간 관측 알림 기능 (FCM Push Notifications)
* **스마트 관측 알림**: 오늘 밤 별을 관측하기 가장 적합한 조건(실시간 Star-Index가 높을 때)이 감지되면 Firebase Cloud Messaging(FCM)을 통해 사용자에게 모바일 푸시 알림을 발송합니다.
* **개인화된 수신 설정**: 마이페이지(ME)의 알림 제어 패널을 통해 실시간 지수 알림 수신 여부를 개별적으로 켜거나 끌 수 있습니다.

### 6. 나이트 비전 모드 (Night Vision Mode)
* **야간 시각 보호**: 칠흑같이 어두운 관측 현장에서 밝은 스마트폰 화면으로 인해 눈의 암적응(Dark Adaptation)이 깨지는 현상을 방지하기 위해, 원클릭으로 모든 UI 테마를 어두운 적색 광선(Red Mode)으로 전환할 수 있습니다.

---

## 🛠️ 기술 스택 (Technology Stack)

| 영역 | 기술 | 상세 설명 |
| :--- | :--- | :--- |
| **Frontend** | React Native (Expo SDK 54) | 크로스 플랫폼 앱 제작, TypeScript 적용 |
| **Backend** | NestJS 10.x | 모듈형 구조, API Swagger 구성 |
| **Database** | PostgreSQL 15 + PostGIS | 공간 데이터(위경도 반경 내 검색) 처리 (Supabase 제공) |
| **Cache & Hydration** | Redis | 외부 API 연동 병목 해결을 위한 실시간 메모리 캐시 레이어 |
| **Storage** | Supabase Storage | 아바타 및 일기 첨부 이미지 객체 저장소 |
| **Notification** | Firebase Cloud Messaging (FCM) | 안드로이드 푸시 알림 발송 |
| **Email API** | Resend API (HTTPS) | Live 서버 환경 SMTP 차단 우회를 위한 HTTPS 메일 발송 |
| **Map Engine** | Kakao Map JS SDK | 정적 HTML 페이지 배포 형태 WebView 로드 |

---

## 🏗️ 시스템 아키텍처 및 복원성 설계 (Resiliency Design)

### 1. 외부 API 타임아웃 & 캐시 폴백 (Upstream Fallback)
기존 기상청(KMA) 및 에어코리아 API의 잦은 유출입 지연으로 인해 발생하던 클라이언트 앱의 무한 로딩("Refreshing...") 현상을 해결하기 위해 다음과 같은 캐시 보존 및 방어 코드가 적용되어 있습니다:
* **Redis 임시 캐시**: 날씨 및 대기 정보를 매 1시간 주기 단위로 가져와 저장합니다.
* **상태 Recalculation**: 캐시를 불러올 때, 좌표 기반 일출/일몰, 태양 및 달 고도 등 천문학 데이터는 **현재 시간 기준**으로 실시간 재계산하므로 캐시를 쓰면서도 정밀한 시간별 지수를 보장합니다.
* **3.5초 타임아웃 & 7일 Stale Cache**: 외부 API 조회가 3.5초를 초과하거나 실패할 경우, 직전에 캐싱된 유효 데이터를 최대 7일(Stale Cache)까지 자동 폴백으로 사용하므로 외부 서버 지연 상황에서도 언제나 즉시 화면이 로드됩니다.

### 2. Live Server 포트 제한 우회 (Resend API)
* Railway와 같은 클라우드 환경에서는 스팸 방지를 위해 외부 SMTP 포트(25, 465, 587)가 기본적으로 차단됩니다.
* 이 문제를 우회하기 위해, 운영 서버 환경에서는 HTTPS API 포트(443)를 이용해 메일을 전송하는 **Resend HTTPS API**를 활용합니다. 개발 환경에서는 기존 SMTP 전송 기능을 이용하도록 자동 폴백 분기 구조가 갖춰져 있습니다.

---

## ⚙️ 로컬 개발 환경 세팅 (Local Development)

### 사전 설치 요구사항
* Node.js v20 이상 (LTS 권장)
* PostgreSQL 15+ & PostGIS 확장팩 (로컬 구동 시)
* Redis (로컬 구동 시)

### 1. 레포지토리 클론
```bash
git clone https://github.com/jjang0617/StarChaser.git
cd StarChaser
```

### 2. 백엔드 (NestJS) 설정
```bash
cd backend
npm install
cp .env.example .env
```
`.env` 파일 내용 편집 (개발용):
```env
PORT=3333
JWT_SECRET=your_jwt_secret_key_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/starchaser?schema=public
REDIS_URL=redis://localhost:6379

# 기상청 및 에어코리아 API 키
KMA_API_KEY=공공데이터포털_기상청_인증키
AIRKOREA_API_KEY=공공데이터포털_에어코리아_인증키

# 메일 전송 설정 (로컬 SMTP용 또는 운영용 Resend API)
RESEND_API_KEY=re_your_resend_api_key (배포 환경 필수)
EMAIL_SMTP_HOST=smtp.gmail.com (로컬용)
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_gmail_app_password

# 카카오 연동
KAKAO_REST_API_KEY=your_kakao_rest_api_key
```
백엔드 실행:
* Windows (Command Prompt):
  ```cmd
  set HOST=0.0.0.0
  set PORT=3333
  npm run start:dev
  ```
* macOS/Linux:
  ```bash
  HOST=0.0.0.0 PORT=3333 npm run start:dev
  ```
정상 접속 확인: `http://localhost:3333/api-docs` (Swagger Document)

---

### 3. 프론트엔드 (React Native / Expo) 설정
```bash
cd ../frontend
npm install
cp .env.example .env
```
`.env` 파일 내용 편집:
```env
# 주의: 에뮬레이터나 실기기(Expo Go) 테스트 시 127.0.0.1이 아닌 PC의 로컬 네트워크 IP(LAN IP)를 기입해야 합니다.
EXPO_PUBLIC_API_URL=http://<PC의_LAN_IP>:3333

# 명소 지도 웹뷰 페이지 배포 주소 (정적 kakao.html 주소 또는 서버 서빙 주소)
EXPO_PUBLIC_KAKAO_MAP_PAGE_URL=https://starchaser-production.up.railway.app/kakao.html

# 기본 데모 명소 ID 및 카카오 키
EXPO_PUBLIC_DEFAULT_SPOT_ID=109119e7-1e13-4d05-94e6-7ea4ef3f06fe
EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY=your_kakao_javascript_key
EXPO_PUBLIC_KAKAO_REST_API_KEY=your_kakao_rest_api_key
```
Expo 개발 서버 실행:
```bash
# Windows
set EXPO_PACKAGER_HOSTNAME=<PC의_LAN_IP>
npm run start -- --host lan --clear

# macOS/Linux
EXPO_PACKAGER_HOSTNAME=<PC의_LAN_IP> npx expo start --host lan --clear
```
이후 폰에서 Expo Go 앱을 열어 터미널의 QR 코드를 스캔합니다.

---

## 🚀 배포 가이드 (Deployment Guide)

### 1. 백엔드 (Railway Deployment)
1. Railway 프로젝트를 생성하고 PostgreSQL 및 Redis 서비스를 추가합니다.
2. `backend` 폴더에서 빌드 시 `nest build`가 성공적으로 실행되도록 환경 변수들을 셋업합니다. (Swagger, DB URL, Redis URL, KMA 키, KAKAO 키 및 `RESEND_API_KEY` 필수 등록)
3. 정적 지도 파일 서빙을 위해 `backend/map-site/kakao.html`이 Railway 서버 루트 도메인의 `/kakao.html` 경로로 정상 서빙되는지 확인합니다.

### 2. 프론트엔드 (EAS Build - Android Preview APK)
1. **EAS 프로젝트 구성**: 로컬 프로젝트가 EAS에 바인딩되었는지 확인합니다. (`app.json`에 `owner: "jjang0617"`, `eas.projectId` 명시)
2. **EAS Secret 주소 설정**:
   * EAS 빌드 시 로컬 `.env` 변수를 덮어쓸 수 있도록 Expo 개발자 대시보드 프로젝트 환경변수(Secrets)에 다음 키값들을 등록해야 합니다:
     * `EXPO_PUBLIC_API_URL` = `https://starchaser-production.up.railway.app` (Railway 백엔드 주소)
     * `EXPO_PUBLIC_KAKAO_MAP_PAGE_URL` = `https://starchaser-production.up.railway.app/kakao.html` (정적 맵 웹뷰 주소)
3. **EAS 빌드 명령어 실행**:
   ```bash
   eas build --platform android --profile preview
   ```
   * 대기열을 건너뛰고 PC 로컬 사양으로 직접 빌드 시:
   ```bash
   eas build --platform android --profile preview --local
   ```
4. **설치 시 주의사항**: 기존에 테스트용으로 구 버전의 StarChaser 앱이 스마트폰에 설치되어 있는 경우, Android Keystore 서명 충돌로 인해 새 APK 설치 시 오류가 납니다. **기존 앱을 완전히 삭제(Uninstall)한 후** 다운로드받은 새로운 APK를 설치하시기 바랍니다.

---

## 🌿 브랜치 전략 (Git Branches)
* **`main`**: 실제 서비스가 구동되는 운영(Production) 브랜치입니다. 직접적인 push가 금지되며 Pull Request를 거쳐 관리됩니다.
* **`develop`**: 개발 중인 코드가 통합되는 통합 브랜치입니다. 로컬 및 스테이징 환경 배포를 위한 기준점이 됩니다.
* **`feat/기능명`**: 개별적인 피처 단위의 개발이 수행되는 브랜치입니다.
* **`fix/버그명`**: 핫픽스 및 오류 수정을 처리하는 브랜치입니다.

---
⭐ **StarChaser**와 함께 아름다운 밤하늘의 쏟아지는 별빛을 사냥해 보세요!
