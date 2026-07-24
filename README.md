# BarnSquire

BarnSquire is a self-hosted barn-management app for horse (and other animal)
facilities. It keeps a barn's daily care organized in one place: who gets fed
what and when, medications, turnout and exercise schedules, appointments,
recurring barn chores, and a per-animal care history — all shared by everyone
who works in the barn.

## Features

- **Multi-barn** — manage several barns from one account, with per-barn roles
  (Global Admin, Barn Manager, Caretaker)
- **Animals** — profiles with photos, home stall/pasture assignment with
  capacity enforcement
- **Today checklist** — the day's feeding, medication, turnout, exercise, and
  barn chores expanded from their schedules, grouped by location and time slot,
  checked off as they're done
- **Schedules** — recurring feeding/medication plans, turnout windows with
  conflict detection, exercise sessions (arena/pasture, trainer, type), and
  barn-level scheduled events like stall cleaning
- **Appointments & reminders** — vet/farrier/dentist visits with recurrence
- **Care ledger** — per-animal history of completed tasks plus custom entries
  with PDF/photo attachments
- **Feed stock** — track servings on hand per feed type; days-left is predicted
  from the active feeding schedules and low-stock refill reminders surface on
  the Today view
- **QR tags** — generate printable PNG and 3D-printable STL tags for barns,
  locations, and animals; the mobile app scans them to jump straight to a stall,
  pasture, or animal. See the [QR tag printing guide](docs/qr-tag-printing.md) for
  recommended print settings
- **Multi-language** — English, Français (Canada), Français (France)
- **Mobile app** — an Expo/React Native companion app ([apps/mobile](apps/mobile))
  with offline reads, queued writes, push notification reminders, camera/document
  scanning into the ledger, QR stall tags, and biometric unlock

## Architecture

pnpm/Turborepo monorepo:

| Path | What it is |
|---|---|
| `apps/web` | Next.js 15 App Router web app (Tailwind + shadcn/ui, NextAuth) |
| `apps/mobile` | Expo (React Native) app — see [its README](apps/mobile/README.md) |
| `packages/trpc` | tRPC v11 routers — all business logic lives here, shared by web and mobile |
| `packages/db` | Prisma 6 schema + client (PostgreSQL) |
| `packages/validators` | Shared Zod schemas |

Files (animal photos, ledger attachments) go to S3-compatible storage via
presigned URLs — MinIO in dev, R2/S3 or any compatible store in prod.

## Quick start (development)

```bash
docker compose up -d      # PostgreSQL + MinIO
pnpm install
pnpm db:push              # sync the Prisma schema
pnpm db:seed              # default user + barn
pnpm dev                  # web app at http://localhost:3000
```

Seeded login: `admin@barnsquire.com` / `password123` (you'll be prompted to
change it). Create the MinIO bucket once via the console at
http://localhost:9001 (`minio` / `minio123`).

See [CLAUDE.md](CLAUDE.md) for conventions and the full development guide, and
`docker-compose.prod.yml` + `Dockerfile` for production deployment.

## License

BarnSquire is **source-available** under the
[Elastic License 2.0](LICENSE). In plain terms:

- ✅ Use it, modify it, and self-host it for your own barn(s) — including
  commercial facilities — free of charge
- ✅ Fork it and share your changes
- ❌ Offer BarnSquire to third parties as a hosted or managed service (SaaS),
  or resell it

## Privacy

BarnSquire is self-hosted: your data lives on the server instance you (or your
barn's operator) run. See [PRIVACY.md](PRIVACY.md) for what the app collects
and how it's used.
