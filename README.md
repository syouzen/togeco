# Togeco

기프티콘 이미지를 함께 등록하고 금액권 잔액을 공유 관리하는 Expo 앱입니다.

## Stack

- Expo + React Native + TypeScript
- expo-router
- PocketBase JS SDK + AsyncStorage auth persistence
- TanStack Query
- expo-image-picker / expo-image-manipulator
- @react-native-ml-kit/barcode-scanning

## Setup

```bash
npm install
cp .env.example .env
npm start
```

`.env`에는 PocketBase URL만 넣습니다. 친구별 계정 이메일/비밀번호는 앱 로그인 화면에서 입력하고, 토큰은 AsyncStorage에 저장되어 재실행 후에도 유지됩니다.

```env
EXPO_PUBLIC_PB_URL=https://your-pb-host
```

계정은 PocketBase 어드민에서 오너가 미리 생성합니다. 앱에는 셀프 회원가입이 없습니다.

## Scan auto-fill

`/add`에는 **갤러리에서 스캔** 버튼이 있습니다.

- 바코드: ML Kit 온디바이스 스캔
- 텍스트/금액/유효기간: PocketBase 커스텀 라우트 `/api/scan` → Gemini 2.5 Flash
- 자동 저장은 하지 않고, 스캔 결과를 폼에 채운 뒤 사용자가 확인/수정하고 저장합니다.
- ML Kit 네이티브 모듈 때문에 Expo Go가 아니라 dev build/EAS dev client가 필요합니다.

PocketBase 쪽 준비:

1. `gifticons`에 `expiry`(date), `barcode`(text)를 추가합니다.
2. `total_amount`, `remaining_amount`는 optional로 바꿔 교환권을 허용합니다.
3. `GEMINI_API_KEY`를 PocketBase 컨테이너 환경변수로 설정합니다.
4. `pb_hooks/main.pb.js`를 PocketBase `/pb_hooks`에 마운트하고 컨테이너를 재시작합니다.

## Scripts

```bash
npm test
npm run typecheck
npm run lint
npm start
```

## Branch flow

- `develop`: normal PR target
- `main`: release/stable
- release: merge `develop` into `main`
