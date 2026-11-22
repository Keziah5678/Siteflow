#!/usr/bin/env bash
# Local PostgreSQL for development and tests (no Docker needed).
# Usage: dev-db.sh start|stop|url   — data in .pgdata/, port 54330 by default.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${RP_PG_PORT:-54330}"
DATA="${RP_PG_DATA:-$PWD/.pgdata}"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(sudo -u postgres)
case "${1:-start}" in
  start)
    if [ ! -d "$DATA/db" ]; then
      mkdir -p "$DATA"; [ "$(id -u)" = "0" ] && chown -R postgres "$DATA"
      "${RUNAS[@]}" "$PGBIN/initdb" -D "$DATA/db" -A trust -U postgres >/dev/null
    fi
    if ! "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" status >/dev/null 2>&1; then
      "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" -o "-p $PORT -c listen_addresses=localhost -k $DATA" -l "$DATA/log" -w start >/dev/null
    fi
    echo "postgres://postgres@localhost:$PORT/postgres" ;;
  stop) "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" -m fast stop >/dev/null 2>&1 || true ;;
  url) echo "postgres://postgres@localhost:$PORT/postgres" ;;
esac
