# BarnSquire Mobile (`@barnsquire/mobile`)

React Native (Expo) app for daily barn work: the **Today** checklist, **food
prep & distribution**, the **barn schedule**, and a per-animal **ledger** with
photos and document scanning. Plus push notifications, offline sync, QR stall
tags, and biometric unlock.

It reuses the existing backend over HTTP — `@barnsquire/trpc` (types only) for
end-to-end type safety and `@barnsquire/validators` (Zod) — and authenticates
with bearer tokens issued by the web app's `/api/mobile/login` endpoint.

## Architecture

- **Auth:** `POST /api/mobile/login` returns an access + refresh JWT (signed with
  `NEXTAUTH_SECRET`). Tokens live in `expo-secure-store`; the tRPC client sends
  `Authorization: Bearer` and refreshes once on a 401. Biometric unlock gates the
  stored session on launch.
- **Data:** tRPC via `@trpc/react-query`. `@barnsquire/trpc/client` is a
  **type-only** entry, so no server code (Prisma / S3) enters the bundle.
- **Uploads:** camera / library / document-scan → `ledger.getUploadUrl` → PUT the
  file straight to S3/MinIO → `ledger.createEntry`.
- **Offline:** React Query cache is persisted to AsyncStorage (offline reads), and
  connectivity is bridged via NetInfo. Completions/skips use `networkMode:
  "offlineFirst"`, so they queue while offline and auto-resume on reconnect.
- **i18n:** the web's `messages/*.json` catalogs, loaded through `i18next` +
  `i18next-icu` (they use ICU MessageFormat) and `expo-localization`.

## Prerequisites

- Node + pnpm (repo root toolchain), the Expo CLI (`npx expo`), and **EAS CLI**
  (`npm i -g eas-cli`) for cloud builds.
- Xcode (iOS) and/or Android Studio if you build the dev client locally.
- The camera, document scanner, push, secure store, and biometrics are **native
  modules** — they require a **dev client or EAS build**, *not* Expo Go.

## First-time setup

From the repo root:

```bash
pnpm install
# Align Expo package versions to the installed SDK (recommended once):
pnpm --filter @barnsquire/mobile exec expo install --fix
```

Backend prep (once): apply the `DeviceToken` schema and set the new env vars.

```bash
pnpm db:push            # adds DeviceToken (see packages/db/prisma/schema.prisma)
# In the root .env / apps/web/.env.local add: CRON_SECRET=...
```

Set the API URL the app should call (see `.env.example`):

```bash
# apps/mobile/.env.local
EXPO_PUBLIC_API_URL=http://<your-LAN-ip>:3000   # a physical device can't reach localhost
```

## Run (development)

```bash
# Terminal 1 — backend
pnpm dev

# Terminal 2 — build & launch the dev client on a simulator/device
pnpm --filter @barnsquire/mobile exec expo run:ios      # or: run:android
# subsequently just start the bundler:
pnpm --filter @barnsquire/mobile dev
```

Log in with a seeded account (`admin@barnsquire.com` / `password123`); the first
login is routed through the change-password screen.

## Push notifications

1. `eas init` to create an EAS project; set `EAS_PROJECT_ID` (used for Expo push
   tokens). The app registers its token on sign-in via `notification.registerDevice`.
2. Trigger the sender from system cron on the server (e.g. each morning):
   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     https://<host>/api/cron/notifications
   ```
   It summarizes each user's due tasks + low feeds across their barns and pushes
   via the Expo Push API.

## Build & distribute

```bash
eas build --profile development --platform ios     # dev client
eas build --profile preview     --platform android # internal test APK/AAB
eas build --profile production   --platform all
```

TestFlight (iOS) and Play internal testing (Android) are the quickest ways to get
it onto staff phones. Store release needs an Apple Developer account ($99/yr) and
Google Play ($25 one-time). Set the real API URL per profile in `eas.json`.

## Type-check

```bash
pnpm --filter @barnsquire/mobile type-check
pnpm --filter @barnsquire/mobile exec expo-doctor   # sanity-check native config
```

## Known limitations / follow-ups

- **Offline writes** queue and resume within a session and across reconnects. A
  queued write surviving a full app restart while still offline (persisted
  mutations with `setMutationDefaults`) is a follow-up; photo/scan uploads are
  online-only by design (the local file must exist).
- **Date helpers** (`lib/dates.ts`) and the **i18n catalogs** (`messages/`) are
  currently duplicated from the web app. Extracting them into shared
  `packages/*` (so web and mobile can't drift) is a clean follow-up.
- **QR stall tags** encode an `animalId` (or a URL containing `animal/<id>`).
  Generating printable stall labels can be added to the web app.
- Relies on Hermes `Intl` timezone support (present on modern Expo). Add an Intl
  polyfill if you target a device that lacks it.
