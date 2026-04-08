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
```

백엔드는 모바일(Expo Go)에서 접근 가능하게 실행해야 한다.

- macOS/Linux
```bash
HOST=0.0.0.0 PORT=3333 npm run start:dev
```

- Windows cmd
```bat
set HOST=0.0.0.0
set PORT=3333
npm run start:dev
```

정상 기준:
- `http://localhost:3333/api-docs` 접속 가능
- 같은 와이파이의 폰 브라우저에서 `http://<내PCIP>:3333/api-docs` 접속 가능

### 3. 프론트엔드 세팅
```bash
cd frontend
npm install
cp .env.example .env
```

`frontend/.env` 예시:
```env
EXPO_PUBLIC_API_URL=http://<내PCIP>:3333
EXPO_PUBLIC_DEFAULT_SPOT_ID=<spots.id UUID>
```

주의:
- Expo Go(폰)에서 `127.0.0.1`은 폰 자기 자신을 의미하므로 사용 금지
- 반드시 백엔드가 열려 있는 PC의 LAN IP 사용

실행:
- macOS/Linux
```bash
EXPO_PACKAGER_HOSTNAME=<내PCIP> npx expo start --host lan --clear
```

- Windows cmd
```bat
set EXPO_PACKAGER_HOSTNAME=<내PCIP>
npm run start -- --host lan --clear
```

정상 기준:
- 터미널에 `Metro waiting on exp://<내PCIP>:8081` 출력
- 폰에서 QR 스캔 후 앱 하단 `API:` 문구가 `http://<내PCIP>:3333`로 표시

### 4. 로그인/Star-Index 확인
1. 앱에서 회원가입 또는 로그인
2. Star-Index 카드에 캐시 부족 오류가 보이면 Swagger에서 `POST /cron/run-once` 1회 실행
3. 앱에서 `다시 시도` 버튼으로 갱신

---

### 문제 해결 (자주 발생)
- `ConfigError: .../starchaser/package.json does not exist`  
  → `frontend` 또는 `backend` 폴더로 이동 후 실행
- `listen EFAULT ... :::8081`  
  → `--host lan --clear` + `EXPO_PACKAGER_HOSTNAME=<내PCIP>`로 재실행
- 앱에서 `알 수 없는 오류` 또는 네트워크 오류  
  → 앱 하단 `API:`가 `127.0.0.1`인지 먼저 확인 (PC IP로 교체 필요)

---

## 지도 (Kakao Map in WebView)

앱에서는 `WebView + Kakao Map JavaScript SDK` 방식으로 지도를 렌더링한다. Kakao JavaScript SDK는 **허용 도메인**이 필요하므로, `map-site/kakao.html`을 **GitHub Pages**로 올리고 WebView에서 그 **전체 URL**을 연다. (프로젝트/개인별 URL은 다를 수 있음)

1. 레포 **Settings → Pages**에서 Source를 **GitHub Actions**로 켠 뒤, `develop`에 `map-site` 관련 변경이 merge되면 `.github/workflows/pages-map.yml`이 배포한다.
2. 배포가 끝나면 브라우저로 접속 가능한 주소가 생긴다. 형태는 보통  
   `https://<GitHub 사용자 또는 조직 이름>.github.io/<레포지토리 이름>/kakao.html`
3. **Kakao Developers** → 앱 → JavaScript 키 설정의 **JavaScript SDK 도메인**에  
   `https://<사용자또는조직>.github.io` 를 등록한다 (경로 `/kakao.html` 없이 호스트만 쓰는 경우가 많음. 콘솔 안내에 맞춤).
4. `frontend/.env`에 아래를 넣는다. (정확한 값은 Pages 배포 후 생성되는 URL)

```env
EXPO_PUBLIC_KAKAO_MAP_PAGE_URL=https://<owner>.github.io/<repo>/kakao.html
```

GitHub Actions Secret `KAKAO_JAVASCRIPT_KEY`에 카카오 JavaScript 키를 넣어 두면, 배포 시 `kakao.html`의 플레이스홀더에 주입된다.


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
