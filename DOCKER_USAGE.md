# Docker Usage

Use this guide to build and run the backend with Docker.

## Build Image

```bash
docker build -t backend .
```

## Run Container

Create a `.env` file (use `env.example` as a reference), then run:

```bash
docker run --name backend \
  --env-file .env \
  -p 4000:4000 \
  backend
```

The API will be available at:
- `http://localhost:4000/api`

## Environment Variables

Commonly required values:
- `DATABASE_URL`
- `JWT_SECRET`
- `APP_BASE_URL`
- `CLIENT_BASE_URL`
- `MAIL_FROM`, `MAIL_USER`, `MAIL_PASS`, `MAIL_ENABLED`, `MAIL_PROVIDER`, `RESEND_API_KEY`

See `env.example` and `src/config/README.md` for the full list.

## Database Migrations

The Docker image only ships the compiled `dist/` output. It does not include the `migrations/` folder, so you should run migrations from your host (or a separate container that has the repo):

```bash
npm run migrate
```

## Optional: Run Postgres via Docker

```bash
docker run --name backend-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=funds \
  -p 5432:5432 \
  postgres:16
```

Then set:
```
DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/funds
```

On Linux, if `host.docker.internal` is not available, use your host IP or run both containers on the same Docker network.
