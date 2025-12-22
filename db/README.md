# Database Directory (`db/`)

This directory is reserved for database-related files, scripts, and utilities that are not migrations.

## 📁 Current Status

Currently empty. This directory can be used for:

## 🎯 Potential Uses

- **Seed files** - Initial data for development/testing
- **Database scripts** - Utility scripts for database operations
- **Backup scripts** - Database backup/restore utilities
- **Schema documentation** - ER diagrams, schema documentation
- **Test fixtures** - Test data files
- **Database utilities** - Helper scripts for common database tasks

## 💡 Suggestions

### Seed Files
Create seed files to populate the database with initial/test data:

```javascript
// db/seeds/01_users.js
export const seedUsers = async (pool) => {
  await pool.query(`
    INSERT INTO users (email, password_hash) VALUES
    ('admin@example.com', '$2b$10$...'),
    ('user@example.com', '$2b$10$...')
  `);
};
```

### Database Scripts
Utility scripts for common operations:

```bash
# db/scripts/backup.sh
pg_dump $DATABASE_URL > backup.sql

# db/scripts/restore.sh
psql $DATABASE_URL < backup.sql
```

### Schema Documentation
Document the database schema:

```markdown
# db/schema.md
## Tables

### users
- id (serial, primary key)
- email (varchar, unique, not null)
- password_hash (varchar, not null)
...
```

## 🔗 Related Directories

- **Migrations** (`migrations/`) - Schema changes and version control
- **Database Config** (`src/config/database.ts`) - Database connection setup

## 📝 Note

If you add files here, update this README to document their purpose and usage.



