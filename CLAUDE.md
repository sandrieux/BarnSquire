# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

BarnSquire is a barn-management web app (multi-barn, animals, feeding/medication
schedules, appointments + recurring reminders, turnout scheduling, and a daily
"Today" checklist). It is web-first but built so a React Native app can be added
later by reusing the shared `@barnsquire/trpc` and `@barnsquire/validators`
packages over HTTP — keep all business logic in tRPC routers, never in
Next.js-only Server Components/Actions.

## Tech Stack

- **Monorepo:** pnpm workspaces + Turborepo (`turbo run <task>`)
- **Web:** Next.js 15 App Router, React, Tailwind + shadcn/ui
- **API:** tRPC v11 (end-to-end types; consumed by web today, mobile later)
- **DB:** PostgreSQL via Prisma 6
- **Auth:** NextAuth (credentials), role claim in the session
- **Storage:** S3-compatible — MinIO in dev, R2/S3 in prod (presigned upload/view)
- **Local infra:** Docker Compose (PostgreSQL + MinIO)

## Layout

```
apps/web/                 Next.js app
  app/(auth)/             login, register
  app/(app)/              authenticated shell (sidebar, BarnSwitcher); force-dynamic
  app/api/trpc/[trpc]/    tRPC HTTP handler
  components/             feature components (animals, feeding, appointments, turnout, locations, today)
  lib/trpc/               client.tsx (provider), server.ts (createServerCaller), types.ts (RouterOutputs)
  lib/auth.ts             NextAuth config
packages/db/              Prisma schema (prisma/schema.prisma), client singleton (src/index.ts), seed (src/seed.ts)
packages/trpc/            routers (src/router/*), context, trpc init, storage.ts (S3 helpers)
packages/validators/      shared Zod schemas
```

tRPC routers: `user`, `barn`, `location`, `animal`, `media`, `feeding`,
`appointment`, `turnout`, `exercise`, `today`, `admin` (merged in
`packages/trpc/src/router/index.ts`).

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
of "Maple Ridge Farm").

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
- **Capacity is enforced server-side** in mutations (`animal.setHomeLocation`,
  `turnout.create/update`), never trusting the client. `location.deleteStall` /
  `deleteBuilding` / `deletePasture` refuse to delete occupied locations
  (`PRECONDITION_FAILED`).
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
  required + optional `endTime` (`"HH:MM"`), `repeatDays`, plus `type`/`trainer`/
  free-text `location`. Managed inline on the animal page; surfaces on Today.
- **Today view** (`today.getDailyView`) expands feeding/medication/turnout/
  exercise from their repeat rules for the requested date on the fly (no
  pre-expanded table) and groups tasks by home location. Completion is an
  append-only `TaskCompletion` ledger (polymorphic FK per task type; add a new
  `<x>ScheduleId` column + `@@unique([<x>Id, scheduledDate])` for new task types).
- **Schema changes:** edit `packages/db/prisma/schema.prisma`, then `pnpm db:push`
  (add `--accept-data-loss` only for intentional destructive dev changes).

## Verifying changes

Beyond `pnpm type-check` and `pnpm build`, router logic is best verified by
driving the tRPC caller directly against the running DB: load the root `.env`,
import `appRouter` + `createContext` + `createCallerFactory`, build a caller for
the seeded admin, exercise the procedures, then clean up. (This is how
capacity/conflict/Today-expansion behavior was validated.)
