# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

BarnSquire is a barn-management web app (multi-barn, animals, feeding/medication
schedules, appointments + recurring reminders, turnout/exercise scheduling,
barn-level scheduled events, a per-animal care ledger with attachments, feed
stock tracking with refill prediction, a daily "Today" checklist, and a
multi-language UI). It is web-first but built so a React Native app can be added
later by reusing the shared `@barnsquire/trpc` and `@barnsquire/validators`
packages over HTTP — keep all business logic in tRPC routers, never in
Next.js-only Server Components/Actions.

## Tech Stack

- **Monorepo:** pnpm workspaces + Turborepo (`turbo run <task>`)
- **Web:** Next.js 15 App Router, React, Tailwind + shadcn/ui
- **API:** tRPC v11 (end-to-end types; consumed by web today, mobile later)
- **DB:** PostgreSQL via Prisma 6
- **Auth:** NextAuth (credentials), role + locale claims in the session
- **Storage:** S3-compatible — MinIO in dev, R2/S3 in prod (presigned upload/view)
- **i18n:** next-intl (no locale routing; cookie/preference-based)
- **Local infra:** Docker Compose (PostgreSQL + MinIO); prod via `Dockerfile` +
  `docker-compose.prod.yml`

## Layout

```
apps/web/                 Next.js app
  app/(auth)/             login, register
  app/(app)/              authenticated shell (sidebar, BarnSwitcher); force-dynamic
  app/api/trpc/[trpc]/    tRPC HTTP handler
  components/             feature components (animals, feeding, appointments, turnout, exercise, locations, barn, today, ledger, stock, schedule, layout)
  i18n/                   next-intl config.ts (locale negotiation) + request.ts (getRequestConfig)
  messages/               translation catalogs (en.json, fr-CA.json, fr-FR.json)
  app/actions/locale.ts   server action: set NEXT_LOCALE cookie + persist via tRPC
  lib/trpc/               client.tsx (provider), server.ts (createServerCaller), types.ts (RouterOutputs)
  lib/auth.ts             NextAuth config
packages/db/              Prisma schema (prisma/schema.prisma), client singleton (src/index.ts), seed (src/seed.ts)
packages/trpc/            routers (src/router/*), context, trpc init, storage.ts (S3 helpers)
packages/validators/      shared Zod schemas
```

tRPC routers: `user`, `barn`, `location`, `animal`, `media`, `feeding`,
`appointment`, `turnout`, `exercise`, `scheduledEvent`, `feedStock`, `ledger`,
`today`, `admin` (merged in `packages/trpc/src/router/index.ts`).

## Commands

Run from the repo root. The dev shell uses nvm; prefix commands with
`export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" &&` if `node`/`pnpm` aren't found.

```bash
docker compose up -d        # start PostgreSQL + MinIO
pnpm install
pnpm db:push                # sync Prisma schema to the DB
pnpm db:seed                # create default user + barn
pnpm dev                    # all packages via turbo; web at http://localhost:3000
pnpm type-check             # tsc --noEmit across packages
pnpm build                  # production build (turbo)
pnpm db:studio              # Prisma Studio
```

Default seeded login: **admin@barnsquire.com** / **password123** (Global Admin
of "Horse Kingdom"). The seeded admin has `mustChangePassword: true`, so the
first login is forced through `/change-password`.

## Environment

A single root `.env` is the source of truth for Prisma + scripts (loaded via
`dotenv-cli` in `packages/db` scripts). `apps/web/.env.local` holds the same vars
for Next.js. See `.env.example` for the full list (`DATABASE_URL`,
`NEXTAUTH_URL`/`NEXTAUTH_SECRET`, `STORAGE_*`). The `.env` is gitignored.

After local `db:seed`, create the MinIO bucket once (name from `STORAGE_BUCKET`,
default `barnsquire`) via the MinIO console at http://localhost:9001
(minio/minio123) or `mc`.

## Conventions & Gotchas

- **Roles:** `GLOBAL_ADMIN` > `BARN_MANAGER` > `CARETAKER`. Mutations are guarded
  in routers via membership/role checks (helpers like `assertBarnAccess` /
  `assertAnimalBarnAccess`). Caretakers complete Today tasks but don't mutate
  schedules.
- **Locations:** stalls (in a building, type `STANDARD`/`QUARANTINE`), pastures
  (in a barn), and arenas (work areas; optional `buildingId`, so standalone or
  inside a building). Arenas have no capacity; exercise schedules reference an
  arena or pasture (`locationArenaId`/`locationPastureId`).
- **Capacity is enforced server-side** in mutations (`animal.setHomeLocation`,
  `turnout.create/update`), never trusting the client. `location.deleteStall` /
  `deleteBuilding` / `deletePasture` refuse to delete occupied locations, and
  `deleteArena` refuses if exercises reference it (`PRECONDITION_FAILED`).
- **IDs are cuids.** Router inputs validate with `.cuid()`; never seed or hardcode
  non-cuid ids (the seed creates barns with generated cuids for this reason).
- **Dates over HTTP:** the server caller returns `Date` objects, but client tRPC
  queries receive ISO strings. For props passed from a server page to a client
  component, prefer a minimal structural type over `RouterOutputs[...]` to avoid
  Date-vs-string mismatches (see `TurnoutManager`/`AnimalForm`).
- **Weekday math:** build a local-midnight date (`new Date(y, m-1, d)`) before
  `getDay()` — `new Date("YYYY-MM-DD")` is UTC midnight and shifts the weekday.
  Feeding `repeatDays` and turnout `repeatDays` use ISO weekdays (1=Mon..7=Sun).
- **Turnout** is a recurring time-of-day window: `startTime`/`endTime` are
  `"HH:MM"` strings (no date) plus `repeatDays`. Conflicts match on overlapping
  time windows AND shared weekdays.
- **Exercise** is a recurring time-of-day activity (like turnout): `startTime`
  required + optional `endTime` (`"HH:MM"`), `repeatDays`, plus `type`/`trainer`
  and a location reference to an arena or pasture (`locationArenaId`/
  `locationPastureId`). Managed inline on the animal page; surfaces on Today.
- **Today view** (`today.getDailyView`) expands feeding/medication/turnout/
  exercise/scheduled-events from their repeat rules for the requested date on the
  fly (no pre-expanded table), groups animal tasks by home location, and puts
  barn-level scheduled events in a dedicated `"barn"` group. Each task carries a
  structured `slot` (`MORNING`/`LUNCH`/`AFTERNOON`/`EVENING`) computed by
  `timeToSlot()` (windows: 06–12, 12–13, 13–18, else); the client slot filter
  matches `task.slot` (not a label prefix). Completion is an append-only
  `TaskCompletion` ledger (polymorphic FK per task type; add a new `<x>ScheduleId`
  column + `@@unique([<x>Id, scheduledDate])` for new task types). `animalId` is
  **optional** so animal-less barn events can be completed.
- **Scheduled events** (`scheduledEvent` router) are barn-level recurring chores
  not tied to an animal (e.g. stall cleaning): `startTime`/`endTime` (`"HH:MM"`) +
  `repeatDays`, managed on the Schedule page; `TaskType.SCHEDULED_EVENT`.
- **Feed stock** (`feedStock` router): one `FeedStock` row per `(barnId, feedType)`
  with a `unit` (canonical), `servingsRemaining` as of `asOfDate`, and
  `thresholdDays` (default 3). Days-left is **predicted**: balance burns down by
  the consumption rate = Σ over active non-medication feeding schedules of
  `(repeatDays.length/7) * parseQuantity(quantity)` (quantity is free-text;
  non-numeric → 1). Refill reminders on Today are **derived** (no stored
  reminder): shown when `daysLeft <= thresholdDays`, cleared by restocking. The
  feeding form sources feed type + unit from stock (unit locked for stock feeds).
- **Care ledger** (`ledger` router): per-animal `LedgerEntry` + `LedgerAttachment`
  (pdf/jpg/png via presigned upload, same pattern as `media`); `getEntries` merges
  custom entries with the `TaskCompletion` history.
- **i18n:** `next-intl` without locale routing. Locale resolves via
  `i18n/request.ts` precedence: `NEXT_LOCALE` cookie → `session.user.locale` →
  `Accept-Language` → `en` (`SUPPORTED_LOCALES` in `i18n/config.ts`). Add a string
  to all of `messages/{en,fr-CA,fr-FR}.json` (keep key parity); use
  `useTranslations()` (client) / `getTranslations()` (server); pass the active
  locale to `formatDate`/`formatTime`. fr-CA and fr-FR are independent catalogs.
- **Schema changes:** edit `packages/db/prisma/schema.prisma`, then `pnpm db:push`
  (add `--accept-data-loss` only for intentional destructive dev changes).
- **Production deploy:** `Dockerfile` (multi-stage, Next.js standalone) +
  `docker-compose.prod.yml`. The Dockerfile copies the full installed workspace
  (`COPY --from=deps /app ./`) so pnpm can resolve `@prisma/client` from each
  package; `@barnsquire/db` runs `prisma generate` on `postinstall`. Storage URLs
  must be browser-reachable; Auth.js needs `trustHost: true`.

## Verifying changes

Beyond `pnpm type-check` and `pnpm build`, router logic is best verified by
driving the tRPC caller directly against the running DB: load the root `.env`,
import `appRouter` + `createContext` + `createCallerFactory`, build a caller for
the seeded admin, exercise the procedures, then clean up. (This is how
capacity/conflict/Today-expansion behavior was validated.)
