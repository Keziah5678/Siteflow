#!/usr/bin/env bash
# Applies the stub, a reconstruction of the beta schema, the v2 migrations
# (twice, for idempotency), then the RLS test-suite, on a throwaway PostgreSQL.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
SOCK="$DATA/sock"; mkdir -p "$SOCK"
cleanup() { "$PGBIN/pg_ctl" -D "$DATA/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
RUNAS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DATA"; RUNAS=(sudo -u postgres); fi
"${RUNAS[@]}" "$PGBIN/initdb" -D "$DATA/db" -A trust -U postgres >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$DATA/log" start >/dev/null
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$HERE/00_supabase_stub.sql"
"${PSQL[@]}" -f "$HERE/01_beta_legacy.sql"
for pass in 1 2; do
  for f in "$HERE"/../migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
done
"${PSQL[@]}" -f "$HERE/10_rls_tests.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
