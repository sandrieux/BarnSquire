#!/bin/sh
# Applies the Prisma schema to the database before starting the server, so each
# deploy self-migrates. Additive changes apply automatically; a *destructive*
# change fails the deploy (loud) instead of silently dropping data — add
# --accept-data-loss below if you ever intend that. Set SKIP_DB_PUSH=1 to bypass.
set -e

if [ "${SKIP_DB_PUSH:-0}" != "1" ]; then
  echo "[entrypoint] Applying database schema (prisma db push)…"
  cd /app/packages/db
  attempt=0
  until node_modules/.bin/prisma db push --skip-generate; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 10 ]; then
      echo "[entrypoint] prisma db push failed after $attempt attempts; aborting."
      exit 1
    fi
    echo "[entrypoint] database not ready (attempt $attempt) — retrying in 3s…"
    sleep 3
  done
  echo "[entrypoint] schema applied."
  cd /app
else
  echo "[entrypoint] SKIP_DB_PUSH=1 — skipping schema apply."
fi

exec "$@"
