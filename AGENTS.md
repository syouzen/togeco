# AGENTS.md — togeco

This repository is being rebuilt from scratch as a private gifticon-sharing app. Treat the current code as disposable unless the user explicitly asks to preserve something.

## Product intent

Build a personal app for a small group to share gifticon images and jointly manage remaining balances.

- Upload gifticon image + name + initial amount.
- Show a shared latest-first list with thumbnail, name, remaining/total amount, and status.
- Show a detail screen with a large image and controls.
- Support partial spending, mark-as-used, and delete.
- No personal accounts, profiles, signup, or login UI. The app auto-signs into one shared PocketBase user at startup.

## Stack

- Expo managed workflow + TypeScript
- expo-router for file-based routing
- PocketBase JS SDK for DB/files/auth
- `@tanstack/react-query` for server state
- `expo-image-picker` for image selection
- `expo-image-manipulator` for pre-upload resize/compression
- Avoid adding global client state libraries unless the user approves it; use React Query for server state and local component state for screen state.

## Backend contract

PocketBase is already built and verified by the owner. Do **not** rebuild the backend unless explicitly asked.

### Environment variables

The app must read these from local `.env` / Expo public env. Never commit real values.

```env
EXPO_PUBLIC_PB_URL=https://your-pb-host
EXPO_PUBLIC_PB_EMAIL=shared@account
EXPO_PUBLIC_PB_PASSWORD=shared-password
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

Important PocketBase behavior: unauthenticated List/Search may return HTTP 200 with `items: []` instead of an obvious 403. Therefore the app must always run `ensureAuth()` before any data query.

## Required auth pattern

Create a PocketBase client similar to:

```ts
import PocketBase from 'pocketbase';

export const pb = new PocketBase(process.env.EXPO_PUBLIC_PB_URL);

export async function ensureAuth() {
  if (pb.authStore.isValid) return;
  await pb.collection('users').authWithPassword(
    process.env.EXPO_PUBLIC_PB_EMAIL!,
    process.env.EXPO_PUBLIC_PB_PASSWORD!,
  );
}
```

Gate the app in `app/_layout.tsx` so no query runs before auth is ready.

## App routes

Use this route shape unless the user changes the product direction:

```txt
app/
  _layout.tsx        # QueryClientProvider + Stack + auth boot gate
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
- [ ] No login/signup UI exists; shared account auth is automatic.

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

- Do not commit real PocketBase URL/email/password.
- Do not add backend migrations or backend setup code unless the user asks.
- Prefer simple UI and small files; v1 is intentionally minimal.
- Keep Korean user-facing copy natural and direct.
- Avoid adding search, categories, push notifications, histories, per-user auth, or realtime subscriptions in v1 unless requested.
- When replacing existing code, remove stale scaffolding instead of leaving dead paths.
