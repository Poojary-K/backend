# Configuration Directory (`config/`)

This directory contains all configuration-related code for the application, including environment variable management and database connection setup.

## 📁 Files

### `env.ts`
**Purpose**: Manages application configuration from environment variables.

**What it does**:
- Loads environment variables using `dotenv`
- Provides type-safe configuration interface (`AppConfig`)
- Parses and validates configuration values
- Provides default values for development

**Configuration Options**:
- `port`: Server port number (default: 4000)
- `appBaseUrl`: Base URL for backend links (default: http://localhost:4000)
- `databaseUrl`: PostgreSQL connection string
- `jwtSecret`: Secret key for JWT token signing
- `jwtExpiresIn`: JWT token expiration time (default: "1h")
- `bcryptSaltRounds`: Number of salt rounds for password hashing (default: 10)
- `mailEnabled`: Enable outbound email notifications (default: true when mail credentials are set)
- `mailFrom`: From address for notification emails
- `mailUser`: SMTP auth user (defaults to `mailFrom` when unset)
- `mailPass`: SMTP app password
- `gdriveOauthClientId`: OAuth client ID (use this instead of service account)
- `gdriveOauthClientSecret`: OAuth client secret
- `gdriveOauthRedirectUri`: OAuth redirect URI (used when generating refresh token)
- `gdriveOauthRefreshToken`: OAuth refresh token
- `gdriveParentFolderId`: Optional parent folder ID for image folders
- `gdriveContributionFolderId`: Pre-created folder ID for contribution images (optional)
- `gdriveCauseFolderId`: Pre-created folder ID for cause images (optional)
- `gdriveMaxFileSizeMb`: Max upload size per image in MB (default: 10)
- `gdriveMaxFiles`: Max images per upload request (default: 10)

**Usage**:
```typescript
import { getConfig } from './config/env.js';

const { port, databaseUrl, jwtSecret } = getConfig();
```

**Important**: Always use `getConfig()` to access configuration. Never access `process.env` directly in other files.

### `database.ts`
**Purpose**: Manages PostgreSQL database connection pool.

**What it does**:
- Creates and manages a singleton PostgreSQL connection pool
- Provides functions for executing queries
- Handles connection lifecycle

**Exported Functions**:
- `getPool()`: Returns the shared connection pool (lazy initialization)
- `query<T>(text, params?)`: Executes a parameterized SQL query
- `getClient()`: Acquires a dedicated client for transactions
- `closePool()`: Gracefully closes the pool (useful for tests)

**Usage**:
```typescript
import { query, getClient } from './config/database.js';

// Simple query
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction example
const client = await getClient();
try {
  await client.query('BEGIN');
  // ... multiple queries ...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## 🔐 Environment Variables

Create a `.env` file in the project root with:

```env
PORT=4000
APP_BASE_URL=http://localhost:4000
DATABASE_URL=postgres://user:password@localhost:5432/funds
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=1h
BCRYPT_SALT_ROUNDS=10
MAIL_FROM=your-email@gmail.com
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password
MAIL_ENABLED=true
GDRIVE_OAUTH_CLIENT_ID=
GDRIVE_OAUTH_CLIENT_SECRET=
GDRIVE_OAUTH_REDIRECT_URI=
GDRIVE_OAUTH_REFRESH_TOKEN=
GDRIVE_PARENT_FOLDER_ID=
GDRIVE_CONTRIB_FOLDER_ID=
GDRIVE_CAUSE_FOLDER_ID=
GDRIVE_MAX_FILE_SIZE_MB=10
GDRIVE_MAX_FILES=10
```

## ⚠️ Important Notes

1. **Never commit `.env` files** - They contain sensitive information
2. **Use strong secrets in production** - Change default JWT_SECRET
3. **Connection pooling** - The pool is shared across the application, don't create multiple pools
4. **Parameterized queries** - Always use parameterized queries to prevent SQL injection
5. **Error handling** - Database errors should be caught and handled appropriately

## 🧪 Testing

For tests, you may need to:
- Use a separate test database
- Call `closePool()` after tests to clean up connections
- Mock the database functions if needed



