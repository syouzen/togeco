# togeco push-sender

PocketBase의 `reminders`를 주기적으로 폴링해, 발송 시각이 된 항목을 해당 사용자의 구독 기기로 **Web Push** 발송하는 백그라운드 서비스다.

웹앱(togeco-web)이 만료 알림 벨로 `reminders`를 저장하면, 이 서비스가 실제 푸시를 보낸다. 발송 후 `sent=true`로 표시해 중복을 막고, 만료된 구독(404/410)은 정리한다.

## 동작

```
reminders (remind_at <= now & sent=false)
   └─ expand gifticon → 사용가능(AVAILABLE)이면
        push_subscriptions(user) 로 web-push 발송
        → sent=true / 410·404 구독 삭제
```

웹 SW와의 페이로드 계약: `{ title, body, url, tag }` (url은 `/gifticons/<id>` 상대경로 → 클릭 시 해당 상세로 이동).

## 사전 준비 (PocketBase)

`push_subscriptions` 컬렉션이 있어야 한다. 필드:

| 필드 | 타입 | 비고 |
|---|---|---|
| `user` | relation → users | required |
| `endpoint` | text | required, unique |
| `p256dh` | text | required |
| `auth` | text | required |
| `user_agent` | text | optional |

API 규칙(소유자 스코프): List/View/Update/Delete `user = @request.auth.id`, Create `@request.auth.id != "" && user = @request.auth.id`.

> `reminders` 컬렉션(`user`, `gifticon`, `remind_at`, `offset_days`, `sent`)은 이미 존재.
> 이 서비스는 superuser로 접속하므로 API 규칙에 막히지 않는다.

## VAPID 키 생성 (최초 1회)

```bash
npx web-push generate-vapid-keys
```

- 공개키 → 웹 프론트 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` **와 이 서비스 `VAPID_PUBLIC_KEY`에 동일하게**
- 비밀키 → 이 서비스 `VAPID_PRIVATE_KEY` (외부 노출 금지)

## 환경변수

`.env.example` 참고. 필수: `PB_URL`, `PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

> PocketBase 0.23 미만이라면 인증 방식이 다르다(`pb.admins.authWithPassword`). 현재 백엔드는 0.23+ JSVM API를 사용하므로 `_superusers`가 맞다.

## 실행

### 로컬 (Node 20+)
```bash
npm install
cp .env.example .env   # 값 채우기
node --env-file=.env src/index.js
```

### Docker / Synology Container Manager (권장)
```bash
docker build -t togeco-push-sender .
docker run -d --name togeco-push-sender --restart always --env-file .env togeco-push-sender
```

Synology에서는 Container Manager로 이미지를 빌드/실행하고, 환경변수를 주입한 뒤 `restart: always`로 둔다. PocketBase가 같은 NAS면 `PB_URL`을 내부 주소로 두어 외부 트래픽을 없앤다.

## 폴링 주기

기본 60초(`POLL_INTERVAL_MS`). reminder는 보통 오전 9시 단위라 1~5분이면 충분하다. `remind_at`은 UTC(ISO)로 저장되고 `now`도 UTC로 비교하므로 시간대 일관성이 유지된다.
