# Togeco

기프티콘 이미지를 함께 등록하고 금액권 잔액을 공유 관리하는 Expo 앱입니다.

## Stack

- Expo + React Native + TypeScript
- expo-router
- PocketBase JS SDK
- TanStack Query
- expo-image-picker / expo-image-manipulator

## Setup

```bash
npm install
cp .env.example .env
npm start
```

`.env`에는 오너가 준비한 PocketBase 공용 계정 값을 넣습니다. 실제 값은 커밋하지 않습니다.

```env
EXPO_PUBLIC_PB_URL=https://your-pb-host
EXPO_PUBLIC_PB_EMAIL=shared@account
EXPO_PUBLIC_PB_PASSWORD=shared-password
```

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
