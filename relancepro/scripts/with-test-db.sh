#!/usr/bin/env bash
# Runs a command against a fresh, migrated, throwaway database on the local server.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=$(bash scripts/dev-db.sh start)
NAME="rp_test_$$_$RANDOM"
ADMIN="${BASE%/*}/postgres"
psql -X -q "$ADMIN" -c "create database $NAME" >/dev/null
export DATABASE_URL="${BASE%/*}/$NAME"
cleanup() { psql -X -q "$ADMIN" -c "drop database if exists $NAME with (force)" >/dev/null 2>&1 || true; }
trap cleanup EXIT
node scripts/migrate.mjs >/dev/null
"$@"
