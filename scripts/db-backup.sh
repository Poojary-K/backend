#!/usr/bin/env bash
# Backup PostgreSQL using backend/.env (or current environment).
# Requires: pg_dump (e.g. apt install postgresql-client-17, or match server major version).
#
# Formats:
#   plain (default) → SQL on stdout, gzip → .sql.gz
#   custom          → pg_dump -Fc → .dump (binary, smaller; restore with db-restore.sh / pg_restore)
#
# Usage:
#   ./scripts/db-backup.sh
#   PG_DUMP_FORMAT=custom ./scripts/db-backup.sh
#   BACKUP_FILE="$PWD/backups/manual.dump" PG_DUMP_FORMAT=custom ./scripts/db-backup.sh
#   PG_DUMP_EXTRA_OPTS="--schema=public --no-owner --no-acl" ./scripts/db-backup.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
PG_DUMP_FORMAT="${PG_DUMP_FORMAT:-plain}"
PG_DUMP_EXTRA_OPTS="${PG_DUMP_EXTRA_OPTS:-}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install PostgreSQL client tools (same major version as the server), e.g.:" >&2
  echo "  sudo apt install postgresql-client-17" >&2
  echo "See docs/DATABASE_BACKUP_RESTORE.md" >&2
  exit 1
fi

run_pg_dump() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    # shellcheck disable=SC2086
    pg_dump $PG_DUMP_EXTRA_OPTS "$@"
  else
    : "${POSTGRES_USER:?Set DATABASE_URL or POSTGRES_USER}"
    : "${POSTGRES_DB:?Set DATABASE_URL or POSTGRES_DB}"
    export PGPASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD or use DATABASE_URL}"
    HOST="${POSTGRES_HOST:-127.0.0.1}"
    PORT="${POSTGRES_PORT:-5432}"
    # shellcheck disable=SC2086
    pg_dump $PG_DUMP_EXTRA_OPTS -h "$HOST" -p "$PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
  fi
}

if [[ "$PG_DUMP_FORMAT" == "custom" ]]; then
  BACKUP_FILE="${BACKUP_FILE:-$BACKUP_DIR/pg_backup_${STAMP}.dump}"
  run_pg_dump -Fc -f "$BACKUP_FILE"
  echo "Wrote (custom format): $BACKUP_FILE"
  exit 0
fi

BACKUP_FILE="${BACKUP_FILE:-$BACKUP_DIR/pg_backup_${STAMP}.sql.gz}"
run_pg_dump | gzip > "$BACKUP_FILE"
echo "Wrote (plain SQL, gzip): $BACKUP_FILE"
