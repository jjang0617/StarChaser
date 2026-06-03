# StarChaser 배포 가이드 (Railway + Android Play)

> **노션용 상세 문서**
> - [NOTION-railway-deploy.md](./NOTION-railway-deploy.md) — Railway 단계별 전체
> - [NOTION-legal-play-email.md](./NOTION-legal-play-email.md) — 방침 HTML, Play URL, support@ 이메일

## 1. 사전 점검 (코드·정책)

- [ ] `NODE_ENV=production` on Railway
- [ ] 오류 메시지에 env명·spotId·cache 키 미노출 (살균 필터 적용됨)
- [ ] Play용 **개인정보 처리방침 HTTPS URL** — `https://<API호스트>/privacy` (배포 후 확인, `legal-documents.ts`와 동일)
- [ ] `SUPPORT_EMAIL` 수신 가능
- [ ] 회원가입 시 약관·방침 동의 UI

## 2. Railway (백엔드)

1. Railway New Project → GitHub `starchaser` 연결
2. **Root Directory**: `backend`
3. **Build**: `npm run build`
4. **Start**: `npm run start:prod`
5. **Variables** (`backend/.env.example` 참고):

| 변수 | 필수 |
|------|------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase Postgres |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | 32자+ 서로 다르게 |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | |
| `KMA_API_KEY`, `AIRKOREA_API_KEY`, `KASI_API_KEY` | |
| `SMTP_*` | 인증 메일 |
| `FIREBASE_*` | FCM |
| `ADMIN_EMAILS` | 관리자 이메일 |
| `CACHE_DRIVER` | `redis` 권장 |
| `REDIS_URL` | Redis addon |
| `STAR_INDEX_WARM_ON_STARTUP` | `true` |

6. 배포 후: 로그인·`GET /star-index` 스모크
7. `EXPO_PUBLIC_API_URL` = Railway public URL (또는 커스텀 도메인)

## 3. EAS Build (Android)

```bash
cd frontend
# EAS secrets: EXPO_PUBLIC_API_URL=https://your-api.up.railway.app
eas build --platform android --profile production
```

- `google-services.json` 패키지 `com.starchaser.app` 일치
- Play App Signing + AAB 업로드

## 4. Google Play Console 순서

1. 개발자 계정 등록
2. 앱 생성 → **내부 테스트** 트랙에 AAB 업로드
3. 스토어 등록: 설명·스크린샷·아이콘
4. **개인정보 처리방침 URL** (HTTPS)
5. **Data safety**: 위치, 이메일, 사진, 기기 ID — 방침과 일치
6. **권한**: 위치(사용 중), 알림, 사진
7. **계정 삭제**: 앱 내 경로 — 마이페이지 → 계정 → 회원 탈퇴
8. Closed testing → 이슈 수정 → Production 심사

## 5. 권장 검증

- 재시작 후 MAIN 로딩 (Redis + warm)
- 503/500 시 사용자 메시지에 내부 용어 없음
- 탈퇴 후 재가입·데이터 미잔존 확인
