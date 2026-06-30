# CLAUDE.md — togeco

Claude Code should follow `AGENTS.md` as the primary project instruction file. This document adds Claude-specific operating notes and a compact handoff for the rebuild.

## Mission

Rebuild this repository as an Expo + TypeScript gifticon-sharing app backed by an already-running PocketBase instance.

The owner expects a clean rewrite. Do not preserve old app structure just because it exists.

## Non-negotiables

1. No login or signup screen.
2. On boot, automatically authenticate to PocketBase with the shared account from Expo public env vars.
3. Do not commit real `.env` secrets.
4. All normal PRs target `develop`, not `main`.
5. Release flow is `develop` → `main`.
6. PocketBase backend is already configured; implement the app client only unless asked otherwise.

## PocketBase client reminder

Use `EXPO_PUBLIC_PB_URL`, `EXPO_PUBLIC_PB_EMAIL`, and `EXPO_PUBLIC_PB_PASSWORD`.

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

PocketBase List/Search rule failures can look like an empty list, so gate queries behind `ensureAuth()`.

## Target screens

```txt
app/_layout.tsx  # auth gate + QueryClientProvider + Stack
app/index.tsx    # list
app/add.tsx      # create
app/[id].tsx     # detail
```

## Data model

`gifticons` fields:

- `name?: string`
- `image: string`
- `total_amount: number`
- `remaining_amount: number`
- `status: 'AVAILABLE' | 'USED'`
- `memo?: string`
- `created: string`

Image URL:

```ts
pb.files.getURL(record, record.image)
```

Partial spend should use the PocketBase atomic number modifier:

```ts
await pb.collection('gifticons').update(id, {
  'remaining_amount-': amount,
  ...(newRemaining <= 0 ? { status: 'USED' } : {}),
});
```

## Branch workflow

```bash
git fetch origin --prune
git switch develop
git pull --ff-only origin develop
git switch -c feat/<topic>
# implement + verify
git push -u origin HEAD
gh pr create --base develop --head feat/<topic>
```

Do not push feature work directly to `main` or `develop`.

## Verification

Use the real scripts in `package.json`. If scripts are missing during the rewrite, add minimal useful scripts and run them before claiming completion, for example:

- TypeScript check
- lint
- tests if introduced
- Expo/React Native smoke checks that are feasible locally

Report real command output status, not assumptions.
