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

# Bring the full installed workspace from deps — root AND per-package
# node_modules (incl. the generated Prisma client). pnpm resolves each
# workspace package's deps (e.g. @prisma/client from packages/db) through its
# own node_modules, so copying only the root would leave those types as `any`.
COPY --from=deps /app ./

# Overlay source. node_modules is excluded via .dockerignore, so the symlinked
# install from deps survives intact.
COPY . .

# Build args are baked into the Next.js bundle at build time. Promote to ENV so
# next.config.ts can read STORAGE_PUBLIC_URL when computing image remotePatterns.
ARG NEXTAUTH_URL
ARG STORAGE_PUBLIC_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV STORAGE_PUBLIC_URL=$STORAGE_PUBLIC_URL

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

# Prisma engine + schema + seed source (needed for db push / seed at runtime)
COPY --from=builder --chown=barnsquire:barnsquire /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=barnsquire:barnsquire /app/packages/db/src ./packages/db/src
COPY --from=builder --chown=barnsquire:barnsquire /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder --chown=barnsquire:barnsquire /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder --chown=barnsquire:barnsquire /app/packages/db/node_modules ./packages/db/node_modules

# Self-migrate on startup: apply the schema (prisma db push), then run the server.
COPY --chown=barnsquire:barnsquire docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER barnsquire

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
