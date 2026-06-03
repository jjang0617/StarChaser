# StarChaser — 방침 HTML · Play URL · support 이메일 (노션용)

> 이 문서를 노션 페이지에 그대로 붙여 넣어 팀 공유·Play 심사 체크리스트로 사용하세요.

---

## 1. Play Console에 넣을 URL (복사용)

배포가 끝난 뒤 **실제 Railway 도메인**으로 아래를 채웁니다.

| 용도 | URL 패턴 | 예시 (교체 필요) |
|------|----------|------------------|
| **개인정보 처리방침 (필수)** | `https://<API호스트>/privacy` | `https://starchaser-production.up.railway.app/privacy` |
| 이용약관 (선택) | `https://<API호스트>/terms` | 동일 호스트 `/terms` |
| 커스텀 도메인 사용 시 | `https://api.starchaser.app/privacy` | DNS·Railway Custom Domain 설정 후 |

앱 코드 상수 (`frontend/content/legal-documents.ts`)도 **동일 URL**로 맞춥니다.

```ts
export const PRIVACY_POLICY_PUBLIC_URL = 'https://<API호스트>/privacy';
export const TERMS_OF_SERVICE_PUBLIC_URL = 'https://<API호스트>/terms';
export const SUPPORT_EMAIL = 'support@starchaser.app';
```

### Play Console 입력 위치

1. Google Play Console → 앱 선택
2. **정책** → **앱 콘텐츠** → **개인정보처리방침**
3. URL란에 `https://<API호스트>/privacy` 붙여넣기 → 저장
4. (선택) 스토어 등록정보에 이용약관 링크 `.../terms`

### 배포 직후 확인

브라우저에서 열었을 때 HTML이 보이고, 로그인 없이 접근 가능해야 합니다.

```text
curl -I https://<API호스트>/privacy
→ HTTP/1.1 200
→ content-type: text/html
```

---

## 2. 방침 HTML 파일 (소스)

레포에 HTML 원본이 있습니다. 수정 시 **두 곳**을 맞춥니다.

| 파일 | 용도 |
|------|------|
| `docs/legal/privacy.html` | 개인정보 처리방침 (노션·호스팅 원본) |
| `docs/legal/terms.html` | 이용약관 |
| `backend/legal-pages/*.html` | API가 서빙하는 복사본 (배포용) |

**수정 절차**

1. `docs/legal/privacy.html` (또는 terms) 편집
2. 동일 내용을 `backend/legal-pages/` 에 복사
3. Railway 재배포
4. Play URL·앱 상수 URL 변경 없으면 그대로 유지

### 노션에 HTML 넣는 방법

**방법 A — 파일 임포트 (권장)**

1. 노션 새 페이지
2. `/import` → **HTML** 선택
3. `docs/legal/privacy.html` 업로드
4. 공개 페이지로 게시 시 URL은 `notion.site/...` 형태 → Play에는 **Railway `/privacy` URL**을 쓰고, 노션은 팀 내부 참고용

**방법 B — 코드 블록**

1. `privacy.html`을 브라우저로 열어 본문만 복사하거나, HTML 전체를 노션 **코드** 블록에 붙여넣기 (서식은 단순해질 수 있음)

**방법 C — Play·앱과 동일 URL만 사용**

노션에는 링크만 기록: `Play 방침 URL = https://<API호스트>/privacy`

---

## 3. support@starchaser.app 수신 설정

### 현재 상태 (점검)

| 항목 | 상태 | 조치 |
|------|------|------|
| 앱·방침·약관에 `support@starchaser.app` 기재 | ✅ 코드 반영됨 | — |
| `starchaser.app` MX(메일) DNS | ⚠️ **미설정 가능성 높음** | 아래 3-A 또는 3-B 필수 |
| 발신 `no-reply@starchaser.app` (SMTP) | Railway `SMTP_*` 설정 시 | 인증메일용, 수신과 별도 |

**support@** 는 **받는 메일** 설정이 없으면 사용자·Play 문의가 반송됩니다. 반드시 아래 중 하나를 진행하세요.

---

### 3-A. Cloudflare Email Routing (무료, 도메인이 Cloudflare DNS일 때 권장)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → `starchaser.app` 존
2. **Email** → **Email Routing** → Enable
3. **Routing rules**
   - Custom address: `support@starchaser.app`
   - Forward to: 팀 Gmail/개인 메일 (예: `yourname@gmail.com`)
4. Cloudflare가 보여주는 **MX·TXT** 레코드를 DNS에 추가 (자동 안내)
5. 테스트: 외부 메일에서 `support@starchaser.app`으로 발송 → 수신 확인

---

### 3-B. Google Workspace (유료, 공식 사서함)

1. Google Workspace 가입 → 도메인 `starchaser.app` 인증
2. 사용자 `support@starchaser.app` 생성 또는 그룹 메일
3. MX를 Google로 변경

---

### 3-C. 도메인만 있고 메일 없을 때 (임시)

Play 심사 전까지는 **실제 수신 가능한 Gmail**을 support로 쓰고, 방침·Play에 그 주소를 넣는 방법도 있습니다.  
이 경우 `legal-documents.ts`의 `SUPPORT_EMAIL`과 HTML의 mailto 링크를 **동일 주소**로 바꾼 뒤 재배포해야 합니다.

---

### 발신 메일 (회원가입 인증번호) — 별도 설정

| 주소 | 역할 | 설정 위치 |
|------|------|-----------|
| `no-reply@starchaser.app` | 인증번호 **발송** | Railway `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| `support@starchaser.app` | 이용자 **문의 수신** | Cloudflare Email Routing 등 |

Gmail SMTP 예시 (`backend/.env` / Railway Variables):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=<앱 비밀번호 16자>
SMTP_FROM=StarChaser <no-reply@starchaser.app>
```

> Gmail은 `From: no-reply@starchaser.app` 발신 시 **SPF/DKIM**이 없으면 스팸 처리될 수 있습니다. 장기적으로는 도메인 SMTP(Zoho, SendGrid, Resend) 권장.

---

### 수신·발신 체크리스트

- [ ] `support@starchaser.app`으로 테스트 메일 발송 → 수신함 도착
- [ ] 앱에서 회원가입 인증번호 메일 수신 (SMTP 설정 후)
- [ ] Play Console 개발자 연락처 이메일과 support 역할 구분 여부 팀 결정

---

## 4. starchaser.app 루트 도메인으로 `/privacy` 쓰고 싶을 때

API는 Railway `*.up.railway.app` 또는 `api.starchaser.app` 입니다.

| 목표 | 설정 |
|------|------|
| `https://api.starchaser.app/privacy` | Railway → Service → **Settings → Networking → Custom Domain** → `api.starchaser.app` CNAME |
| `https://starchaser.app/privacy` | (1) Cloudflare Pages에 HTML 호스팅 + `/privacy` 경로, 또는 (2) `starchaser.app` → Pages, `api.starchaser.app` → Railway |

Play에는 **HTTPS로 열리는 하나의 URL**만 맞으면 됩니다. 커스텀 도메인 없이 Railway 기본 URL도 심사 가능합니다.

---

## 5. 한 줄 요약

- **Play 필수 URL**: `https://<Railway API 호스트>/privacy` (배포 후 브라우저 확인)
- **HTML 원본**: `docs/legal/privacy.html`, `terms.html`
- **support@**: Cloudflare Email Routing 등으로 **수신** 설정 후 테스트 메일 필수
- **노션**: HTML import 또는 위 URL만 문서화
