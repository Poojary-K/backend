# Database backup and restore

Scripts live in `scripts/`. They read **`backend/.env`** (or export the same variables in your shell).

- `db-backup.sh` — `pg_dump` to **plain SQL (gzip)** by default, or **custom** (`.dump`) for `pg_restore`.
- `db-restore.sh` — **`pg_restore`** for `.dump`, **`psql`** for `.sql` / `.sql.gz`.

PostgreSQL client version should match the server **major version** when possible (e.g. 17 with Docker Postgres 17).

## Prerequisites

- `pg_dump`, `pg_restore`, `psql` on your PATH (`postgresql-client` package), **or** run from a machine that has them.
- A reachable database and credentials in `.env`.

## Environment variables

| Variable | Role |
|----------|------|
| `DATABASE_URL` | Preferred. **URL-encode** special characters in the password (`@` → `%40`, `$` → `%24`, etc.). |
| `POSTGRES_HOST` | Default `127.0.0.1` if not using `DATABASE_URL`. |
| `POSTGRES_PORT` | Default `5432`. |
| `POSTGRES_USER` | Database user. |
| `POSTGRES_PASSWORD` | Password (no encoding needed here). |
| `POSTGRES_DB` | Database name. |

If `DATABASE_URL` is awkward (password with `@`), omit it and set the `POSTGRES_*` variables instead.

## Backup

From the **`backend`** directory:

```bash
# Plain SQL, gzip (default): backups/pg_backup_YYYYMMDD_HHMMSS.sql.gz
npm run db:backup
# or
bash scripts/db-backup.sh
```

Custom format (binary, good for local restore / `pg_restore`):

```bash
PG_DUMP_FORMAT=custom bash scripts/db-backup.sh
# → backups/pg_backup_YYYYMMDD_HHMMSS.dump
```

Optional output path:

```bash
BACKUP_FILE="$PWD/backups/my_backup.sql.gz" bash scripts/db-backup.sh
BACKUP_FILE="$PWD/backups/my_backup.dump" PG_DUMP_FORMAT=custom bash scripts/db-backup.sh
```

**Public schema only** (typical for app DBs):

```bash
PG_DUMP_EXTRA_OPTS="--schema=public --no-owner --no-acl" bash scripts/db-backup.sh
```

**Supabase / remote:** use an encoded `DATABASE_URL` or `POSTGRES_*` pointing at the remote host. For large hosted DBs, prefer their docs; transaction poolers may not suit `pg_dump`—use the **direct** session connection if offered.

## Restore

The **database must already exist** (e.g. `CREATE DATABASE funds;` or your Docker `POSTGRES_DB`).

From **`backend`**:

```bash
# Plain SQL gzip
npm run db:restore -- backups/pg_backup_20260331_120000.sql.gz

# Custom .dump
npm run db:restore -- backups/pg_backup_20260331_120000.dump
```

Paths can be relative to the current directory, or under `backend/`, or under `backend/backups/` (script tries those).

**Replace existing objects** (use on a DB you are resetting—destructive):

```bash
PG_RESTORE_CLEAN=1 npm run db:restore -- backups/some.dump
```

This adds `pg_restore --clean --if-exists`. For **plain SQL**, use `psql` with a dump that already contains `DROP` statements, or drop the DB and recreate it.

**Extra `pg_restore` flags:**

```bash
PG_RESTORE_EXTRA_OPTS="--jobs=4" npm run db:restore -- backups/file.dump
```

## npm scripts

| Script | Command |
|--------|---------|
| `npm run db:backup` | `bash scripts/db-backup.sh` |
| `npm run db:restore -- <file>` | `bash scripts/db-restore.sh <file>` |

## Common problems

1. **`password authentication failed`** — Wrong password, or `DATABASE_URL` broken by unencoded `@` in the password.
2. **`pg_dump` / `pg_restore` not found** — Install PostgreSQL client tools.
3. **Full Supabase dump into stock Postgres** — Includes schemas/extensions your local image does not have. Prefer **`pg_dump --schema=public`** (or only your app tables) for local dev.
4. **“relation already exists” on restore** — Restore into an **empty** database, or use `PG_RESTORE_CLEAN=1` with a **custom** dump.
5. **Port 5432 in use** — Stop host PostgreSQL or map Docker to another port and set `POSTGRES_PORT` / `DATABASE_URL` accordingly.

## Git

`backups/` is listed in `.gitignore`; do not commit dumps containing real user data.
