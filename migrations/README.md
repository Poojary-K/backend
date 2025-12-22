# Migrations Directory (`migrations/`)

This directory contains database migration files that manage schema changes and data transformations in a version-controlled, repeatable way.

## 📁 Files

- `0001_init.cjs` - Initial database schema setup
- `0002_causes_amount_and_view.cjs` - Adds amount field to causes and creates views
- `0003_drop_targetamount.cjs` - Removes targetamount column
- `0004_update_fundstatusview.cjs` - Updates fund status view

## 🎯 Purpose

Migrations provide:
1. **Version control for database** - Track schema changes over time
2. **Reproducible setup** - Create database from scratch
3. **Team collaboration** - Everyone has the same schema
4. **Rollback capability** - Undo changes if needed
5. **Environment consistency** - Same schema in dev/staging/production

## 🔧 Migration Tool

This project uses **node-pg-migrate** for database migrations.

## 📝 Migration File Naming

Migrations follow this naming pattern:
```
<sequence_number>_<descriptive_name>.cjs
```

Examples:
- `0001_init.cjs` - First migration, initial setup
- `0002_causes_amount_and_view.cjs` - Second migration, adds causes amount
- `0003_drop_targetamount.cjs` - Third migration, removes targetamount

## 🚀 Running Migrations

### Apply All Pending Migrations
```bash
npm run migrate
```

### Rollback Last Migration
```bash
npm run migrate:down
```

### Check Migration Status
```bash
npx node-pg-migrate list
```

## 📋 Migration File Structure

Migrations export an `up` and `down` function:

```javascript
/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  // Apply migration
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  // Rollback migration
  pgm.dropTable('users');
};
```

## ✅ Migration Best Practices

### DO:
- ✅ Write reversible migrations (both `up` and `down`)
- ✅ Use descriptive names
- ✅ Test migrations on a copy of production data
- ✅ Keep migrations small and focused
- ✅ Never modify existing migrations (create new ones)
- ✅ Use transactions when possible
- ✅ Add indexes for performance
- ✅ Consider data migration separately from schema changes

### DON'T:
- ❌ Modify existing migrations (creates new ones instead)
- ❌ Delete migration files
- ❌ Skip sequence numbers
- ❌ Make breaking changes without planning
- ❌ Forget to test rollback (`down` function)

## 🔍 Common Migration Patterns

### Creating Tables
```javascript
exports.up = (pgm) => {
  pgm.createTable('items', {
    id: 'id',
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });
  
  pgm.createIndex('items', 'name');
};
```

### Adding Columns
```javascript
exports.up = (pgm) => {
  pgm.addColumn('items', {
    status: { type: 'varchar(50)', notNull: true, default: 'active' },
  });
};
```

### Creating Views
```javascript
exports.up = (pgm) => {
  pgm.createView('item_summary', {
    replace: true,
  }, 'SELECT id, name, status FROM items WHERE status = \'active\'');
};
```

### Data Migrations
```javascript
exports.up = (pgm) => {
  // Update existing data
  pgm.sql(`
    UPDATE items 
    SET status = 'active' 
    WHERE status IS NULL
  `);
};
```

## 🔄 Migration Workflow

1. **Create migration file**:
   ```bash
   npx node-pg-migrate create migration_name
   ```

2. **Write migration** - Implement `up` and `down` functions

3. **Test locally**:
   ```bash
   npm run migrate:down  # Rollback
   npm run migrate       # Apply
   ```

4. **Commit migration** - Add to version control

5. **Apply in other environments** - Run `npm run migrate` in staging/production

## ⚠️ Important Notes

1. **Never edit existing migrations** - Always create new ones
2. **Test rollbacks** - Ensure `down` functions work correctly
3. **Backup production** - Always backup before running migrations in production
4. **Run in transaction** - Some operations can't be rolled back
5. **Migration order matters** - Migrations run in sequence number order

## 🔗 Related Files

- **Database Config** (`src/config/database.ts`) - Database connection used by migrations
- **Environment Config** (`src/config/env.ts`) - Database URL configuration

## 📚 Resources

- [node-pg-migrate Documentation](https://salsita.github.io/node-pg-migrate/)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)

