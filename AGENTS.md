# AGENTS.md — togeco

This repository is being rebuilt from scratch as a private gifticon-sharing app. Treat the current code as disposable unless the user explicitly asks to preserve something.

## Product intent

Build a personal app for a small group to share gifticon images and jointly manage remaining balances.

- Upload gifticon image + name + initial amount.
- Show a shared latest-first list with thumbnail, name, remaining/total amount, and status.
- Show a detail screen with a large image and controls.
- Support partial spending, mark-as-used, and delete.
- Login UI is required. Users sign in with a normal PocketBase `users` auth account before seeing gifticons.

## Stack

- Expo managed workflow + TypeScript
- expo-router for file-based routing
- PocketBase JS SDK for DB/files/auth
- `@tanstack/react-query` for server state
- `expo-image-picker` for image selection
- `expo-image-manipulator` for pre-upload resize/compression
- `@react-native-async-storage/async-storage` for PocketBase token persistence
- Avoid adding global client state libraries unless the user approves it; use React Query for server state and local component state for screen state.

## Backend contract

PocketBase is already built and verified by the owner. Do **not** rebuild the backend unless explicitly asked.

### Environment variables

The app must read the PocketBase URL from local `.env` / Expo public env. Never commit real secrets.

```env
EXPO_PUBLIC_PB_URL=https://your-pb-host
```

Keep `.env.example` placeholder-only.

### Collection: `gifticons`

Fields:

- `name`: text, optional
- `image`: single image file
- `total_amount`: number
- `remaining_amount`: number
- `status`: single select, `AVAILABLE` or `USED`
- `memo`: text, optional
- `created`: autodate, used for latest-first sorting
- `id`: PocketBase automatic id

API rules for List/View/Create/Update/Delete are already configured as authenticated-only:

```pb
@request.auth.id != ""
```

Important PocketBase behavior: unauthenticated List/Search may return HTTP 200 with `items: []` instead of an obvious 403. Therefore the app must block data screens until the user has logged in.

## Required auth pattern

Create a PocketBase client with `AsyncAuthStore` so users usually log in once:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import PocketBase, { AsyncAuthStore } from 'pocketbase';

const store = new AsyncAuthStore({
  save: (serialized) => AsyncStorage.setItem('togeco_auth', serialized),
  initial: AsyncStorage.getItem('togeco_auth'),
  clear: () => AsyncStorage.removeItem('togeco_auth'),
});
export const pb = new PocketBase(process.env.EXPO_PUBLIC_PB_URL, store);

export async function login(email: string, password: string) {
  await pb.collection('users').authWithPassword(email, password);
}
```

Add a login page and gate list/add/detail screens so no gifticon query runs before auth is ready. On restart, restore the persisted token before deciding whether to redirect.

## App routes

Use this route shape unless the user changes the product direction:

```txt
app/
  _layout.tsx        # QueryClientProvider + Stack
  login.tsx          # email/password login
  index.tsx          # gifticon list
  add.tsx            # gifticon creation
  [id].tsx           # gifticon detail
```

## Core behaviors

### List

- Latest-first by `-created`.
- Card includes thumbnail, name, `remaining_amount / total_amount`, and status badge.
- Include pull-to-refresh.
- Refetch on screen focus. Realtime subscription is out of v1 scope.

### Add

- Pick image from gallery.
- Resize/compress to max width 1080px, JPEG quality around 0.7 before upload.
- Required amount input.
- Upload via `FormData` to PocketBase file field.
- Initial `remaining_amount` equals `total_amount` and status is `AVAILABLE`.

### Detail

- Show large image and full values.
- Partial spend validates `0 < amount <= remaining_amount` before calling the backend.
- Use PocketBase number-field subtraction modifier for atomic decrement:

```ts
await pb.collection('gifticons').update(id, {
  'remaining_amount-': amount,
  ...(newRemaining <= 0 ? { status: 'USED' } : {}),
});
```

- Mark used sets `status: 'USED'` and `remaining_amount: 0`.
- Delete requires one confirmation and then deletes the record; PocketBase deletes the attached file.

## Acceptance checklist

- [ ] List shows existing gifticons latest-first with thumbnail, name, amount, and status.
- [ ] Add flow creates a PocketBase record with uploaded image and returns to a refreshed list.
- [ ] Detail shows the large image and values.
- [ ] Partial spend rejects invalid/over-balance amounts and marks `USED` when balance reaches zero.
- [ ] Mark used and delete work.
- [ ] A second device sees changes after focus/refetch or pull-to-refresh.
- [ ] Login screen exists; no signup UI exists; data screens require a valid PocketBase auth token.
- [ ] Login persists across app restarts through AsyncStorage; logout clears the stored token.

## Branch and release workflow

Use the same flow as the admin/web/baton projects.

- `main`: release/stable branch.
- `develop`: integration branch for normal work.
- Feature/fix/docs branches must branch from `develop`.
- Pull requests target `develop` by default.
- Release is done by merging `develop` into `main`.
- Do not push implementation work directly to `main`.
- Prefer conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`.

Recommended branch names:

- `feat/<short-topic>`
- `fix/<short-topic>`
- `docs/<short-topic>`
- `chore/<short-topic>`

Before opening a PR:

1. Start from a clean, updated `develop`.
2. Keep unrelated generated files out of commits.
3. Run the repository's actual verification commands.
4. Push the branch and open a PR into `develop`.

## Implementation discipline

- Do not commit real PocketBase URL, account email, or password.
- Do not add backend migrations or backend setup code unless the user asks.
- Prefer simple UI and small files; v1 is intentionally minimal.
- Keep Korean user-facing copy natural and direct.
- Avoid adding search, categories, push notifications, histories, per-user auth, or realtime subscriptions in v1 unless requested.
- When replacing existing code, remove stale scaffolding instead of leaving dead paths.
