#!/usr/bin/env bash
# Restore PostgreSQL from a backup file using backend/.env (or current environment).
#
# Supports:
#   - Custom format: .dump (and similar) → pg_restore
#   - Plain SQL:     .sql → psql -f
#   - Gzip plain SQL: .sql.gz → gunzip | psql  (not gzip-wrapped custom format)
#
# Target database must exist. For a full replace, set PG_RESTORE_CLEAN=1 (adds --clean --if-exists).
#
# Usage:
#   ./scripts/db-restore.sh ./backups/pg_backup_20260101_120000.sql.gz
#   ./scripts/db-restore.sh ./backups/pg_backup_20260101_120000.dump
#   PG_RESTORE_CLEAN=1 ./scripts/db-restore.sh ./backup.dump
#   PG_RESTORE_EXTRA_OPTS="--verbose" ./scripts/db-restore.sh ./backup.dump

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.sql|backup.sql.gz|backup.dump>" >&2
  exit 1
fi

INPUT="${1#./}"
if [[ "$INPUT" != /* ]]; then
  INPUT="$(pwd)/$INPUT"
fi
if [[ ! -f "$INPUT" ]]; then
  if [[ -f "$ROOT_DIR/$1" ]]; then
    INPUT="$ROOT_DIR/$1"
  elif [[ -f "$ROOT_DIR/backups/$1" ]]; then
    INPUT="$ROOT_DIR/backups/$1"
  else
    echo "File not found: $INPUT" >&2
    exit 1
  fi
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PG_RESTORE_EXTRA_OPTS="${PG_RESTORE_EXTRA_OPTS:-}"
CLEAN_FLAGS=()
if [[ "${PG_RESTORE_CLEAN:-0}" == "1" ]] || [[ "${PG_RESTORE_CLEAN:-}" == "true" ]]; then
  CLEAN_FLAGS=(--clean --if-exists)
fi

is_custom_format_dump() {
  local f="$1"
  case "$f" in
    *.dump | *.backup | *.pgdump)
      return 0
      ;;
  esac
  if command -v file >/dev/null 2>&1; then
    local brief
    brief="$(file --brief "$f" 2>/dev/null || true)"
    if echo "$brief" | grep -qi 'PostgreSQL custom database dump'; then
      return 0
    fi
  fi
  return 1
}

run_pg_restore() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    # shellcheck disable=SC2086
    pg_restore "${CLEAN_FLAGS[@]}" --no-owner --no-acl -v \
      $PG_RESTORE_EXTRA_OPTS \
      -d "$DATABASE_URL" "$INPUT"
  else
    : "${POSTGRES_USER:?Set DATABASE_URL or POSTGRES_USER}"
    : "${POSTGRES_DB:?Set DATABASE_URL or POSTGRES_DB}"
    export PGPASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD or use DATABASE_URL}"
    HOST="${POSTGRES_HOST:-127.0.0.1}"
    PORT="${POSTGRES_PORT:-5432}"
    # shellcheck disable=SC2086
    pg_restore "${CLEAN_FLAGS[@]}" --no-owner --no-acl -v \
      $PG_RESTORE_EXTRA_OPTS \
      -h "$HOST" -p "$PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$INPUT"
  fi
}

run_psql() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    psql "$DATABASE_URL" "$@"
  else
    : "${POSTGRES_USER:?Set DATABASE_URL or POSTGRES_USER}"
    : "${POSTGRES_DB:?Set DATABASE_URL or POSTGRES_DB}"
    export PGPASSWORD="${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD or use DATABASE_URL}"
    HOST="${POSTGRES_HOST:-127.0.0.1}"
    PORT="${POSTGRES_PORT:-5432}"
    psql -h "$HOST" -p "$PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
  fi
}

if is_custom_format_dump "$INPUT"; then
  echo "Restoring custom-format dump with pg_restore: $INPUT"
  run_pg_restore
  echo "Restore finished (pg_restore)."
  exit 0
fi

if [[ "$INPUT" =~ \.gz$ ]]; then
  if [[ "$INPUT" =~ \.sql\.gz$ ]] || file --brief "$INPUT" 2>/dev/null | grep -qi gzip; then
    echo "Restoring gzip plain SQL: $INPUT"
    gunzip -c "$INPUT" | run_psql -v ON_ERROR_STOP=1
  else
    echo "Unknown .gz content; expected .sql.gz (plain SQL). For custom format use .dump without gzip." >&2
    exit 1
  fi
else
  echo "Restoring plain SQL: $INPUT"
  run_psql -v ON_ERROR_STOP=1 -f "$INPUT"
fi

echo "Restore finished using $INPUT"
