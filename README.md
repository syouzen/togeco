# Togeco

기프티콘 이미지를 함께 등록하고 금액권 잔액을 공유 관리하는 Expo 앱입니다.

## Stack

- Expo + React Native + TypeScript
- expo-router
- PocketBase JS SDK + AsyncStorage auth persistence
- TanStack Query
- expo-image-picker / expo-image-manipulator

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
