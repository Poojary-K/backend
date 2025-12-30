# Backend

TypeScript/Express API for managing members, causes, contributions, and fund status. The codebase follows a layered architecture (routes → controllers → services → repositories) with PostgreSQL as the data store.

## Features

- JWT-based authentication and admin elevation
- Member CRUD support (see API usage guide)
- Cause and contribution tracking
- Fund status summary
- Email notifications for contribution and cause create/update/delete events
- Google Drive image storage for contribution/cause attachments (public links)
- Zod validation and centralized error handling
- Database migrations via `node-pg-migrate`

## Tech Stack

- Node.js, TypeScript, Express
- PostgreSQL (`pg`, `node-pg-migrate`)
- Zod validation
- JWT auth, bcrypt password hashing
- Jest for tests
- Nodemailer for outbound email

## Getting Started

### Prerequisites

- Node.js 18+ (or a compatible version)
- PostgreSQL instance

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from the example:
   ```bash
   cp env.example .env
   ```

3. Update `.env` with your settings:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `ADMIN_SECRET_CODE`
   - `MAIL_FROM`, `MAIL_USER`, `MAIL_PASS`, `MAIL_ENABLED` (optional, for email notifications)

4. Run migrations:
   ```bash
   npm run migrate
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

Server runs on `http://localhost:4000` by default.

## Email Notifications

Notifications are sent on create/update/delete for contributions (to the member) and causes (to all members).

- Templates: `src/config/emailTemplates.json`
- Shared layout: `src/config/emailLayout.html`
- Config: `MAIL_FROM`, `MAIL_USER`, `MAIL_PASS`, `MAIL_ENABLED`

If Gmail is used, an app password is required.

## Image Uploads (Google Drive)

Contribution/cause images are uploaded to Google Drive and stored as public links in the database.

Required env variables:
- OAuth credentials (`GDRIVE_OAUTH_CLIENT_ID`, `GDRIVE_OAUTH_CLIENT_SECRET`, `GDRIVE_OAUTH_REFRESH_TOKEN`)
- Optional folder IDs: `GDRIVE_CONTRIB_FOLDER_ID`, `GDRIVE_CAUSE_FOLDER_ID`
- Limits: `GDRIVE_MAX_FILE_SIZE_MB`, `GDRIVE_MAX_FILES`

## API Usage

See `USAGE.md` for endpoint details, sample requests, and Postman setup.

## Scripts

- `npm run dev` - Start dev server with hot reload
- `npm run build` - Compile TypeScript to `dist/`
- `npm run start` - Run compiled server
- `npm run test` - Run Jest tests
- `npm run lint` - Run ESLint
- `npm run format` - Check Prettier formatting
- `npm run migrate` - Run database migrations
- `npm run migrate:down` - Roll back the last migration

## Project Structure

See `src/README.md` for the full directory breakdown and architecture explanation. Related docs:

- `src/config/README.md` - Configuration and env vars
- `src/routes/README.md` - Routing conventions
- `src/controllers/README.md` - Controller responsibilities
- `src/services/README.md` - Service layer patterns
- `src/repositories/README.md` - Repository layer patterns
- `src/tests/README.md` - Testing guidance

## Testing

```bash
npm run test
```
