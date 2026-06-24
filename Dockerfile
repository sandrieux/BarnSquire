# syntax=docker/dockerfile:1

# ── deps ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/trpc/package.json ./packages/trpc/
COPY packages/validators/package.json ./packages/validators/

# Prisma schema must be present so the db package's postinstall
# (prisma generate) can run during install.
COPY packages/db/prisma ./packages/db/prisma

RUN pnpm install --frozen-lockfile

# ── builder ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Build args are baked into the Next.js bundle at build time
ARG NEXTAUTH_URL
ARG STORAGE_PUBLIC_URL

RUN pnpm build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S barnsquire && adduser -S barnsquire -G barnsquire

# Standalone output from Next.js
COPY --from=builder --chown=barnsquire:barnsquire /app/apps/web/.next/standalone ./
COPY --from=builder --chown=barnsquire:barnsquire /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=barnsquire:barnsquire /app/apps/web/public ./apps/web/public

# Prisma engine + schema (needed for db:push / db:seed at runtime)
COPY --from=builder --chown=barnsquire:barnsquire /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=barnsquire:barnsquire /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder --chown=barnsquire:barnsquire /app/packages/db/node_modules ./packages/db/node_modules

USER barnsquire

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
