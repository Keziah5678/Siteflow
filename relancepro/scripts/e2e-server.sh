#!/usr/bin/env bash
# Starts the production build on a fresh, migrated database for end-to-end tests.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=$(bash scripts/dev-db.sh start)
ADMIN_DB="${BASE%/*}/postgres"
psql -X -q "$ADMIN_DB" -c "drop database if exists rp_e2e with (force)" -c "create database rp_e2e" >/dev/null
export DATABASE_URL="${BASE%/*}/rp_e2e"
node scripts/migrate.mjs >/dev/null
export APP_URL="http://localhost:${E2E_PORT:-3200}" ADMIN_EMAILS="admin@relancepro-e2e.fr" CRON_SECRET="e2e-cron-secret" RP_DEV_TOOLS=true RP_ALLOW_DEV_KEY=true NODE_ENV=production
exec npx next start -p "${E2E_PORT:-3200}"
