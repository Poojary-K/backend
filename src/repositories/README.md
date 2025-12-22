# Repositories Directory (`repositories/`)

Repositories handle all database interactions and data access. They abstract away SQL queries and provide a clean interface for services to interact with the database.

## 📁 Files

- `memberRepository.ts` - Member data access operations
- `causeRepository.ts` - Cause data access operations
- `contributionRepository.ts` - Contribution data access operations
- `fundRepository.ts` - Fund status and aggregation queries

## 🎯 Purpose

Repositories are responsible for:
1. **Database queries** - All SQL queries live here
2. **Data access** - CRUD operations for entities
3. **Query optimization** - Efficient database queries
4. **Type safety** - TypeScript types for database results
5. **Abstraction** - Hide database implementation details from services

## 📝 Repository Pattern

Repositories follow this pattern:

```typescript
import { query } from '../config/database.js';

export interface EntityRecord {
  readonly id: number;
  readonly name: string;
  // ... other fields
}

export const getEntityById = async (id: number): Promise<EntityRecord | null> => {
  const text = 'SELECT * FROM entities WHERE id = $1';
  const result = await query<EntityRecord>(text, [id]);
  return result.rows[0] ?? null;
};
```

## 🔍 Key Responsibilities

### ✅ DO in Repositories:
- Write all SQL queries
- Handle database-specific logic
- Map database results to TypeScript types
- Use parameterized queries (prevent SQL injection)
- Handle database errors appropriately
- Define TypeScript interfaces for database records

### ❌ DON'T in Repositories:
- Implement business logic (that's services)
- Handle HTTP requests/responses (that's controllers)
- Access `req` or `res` objects
- Make decisions about business rules

## 📋 Example Repository

```typescript
import { query } from '../config/database.js';

export interface UserRecord {
  readonly id: number;
  readonly email: string;
  readonly password_hash: string;
  readonly created_at: Date;
}

export const getUserById = async (id: number): Promise<UserRecord | null> => {
  const text = 'SELECT * FROM users WHERE id = $1';
  const result = await query<UserRecord>(text, [id]);
  return result.rows[0] ?? null;
};

export const createUser = async (data: {
  email: string;
  password_hash: string;
}): Promise<UserRecord> => {
  const text = `
    INSERT INTO users (email, password_hash)
    VALUES ($1, $2)
    RETURNING *
  `;
  const result = await query<UserRecord>(text, [data.email, data.password_hash]);
  return result.rows[0]!;
};
```

## 🔐 Security Best Practices

### Always Use Parameterized Queries

✅ **Good**:
```typescript
const text = 'SELECT * FROM users WHERE email = $1';
const result = await query(text, [email]);
```

❌ **Bad** (SQL Injection vulnerability):
```typescript
const text = `SELECT * FROM users WHERE email = '${email}'`;
const result = await query(text);
```

## 📊 Common Repository Patterns

### 1. CRUD Operations
```typescript
export const create = async (data) => { /* INSERT */ };
export const getById = async (id) => { /* SELECT WHERE id */ };
export const getAll = async () => { /* SELECT * */ };
export const update = async (id, data) => { /* UPDATE WHERE id */ };
export const deleteById = async (id) => { /* DELETE WHERE id */ };
```

### 2. Complex Queries
```typescript
export const getWithRelations = async (id) => {
  const text = `
    SELECT u.*, p.name as profile_name
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE u.id = $1
  `;
  return query(text, [id]);
};
```

### 3. Aggregations
```typescript
export const getSummary = async () => {
  const text = 'SELECT COUNT(*) as total, SUM(amount) as sum FROM contributions';
  return query(text);
};
```

## 🎨 Type Definitions

Each repository should define TypeScript interfaces for database records:

```typescript
export interface EntityRecord {
  readonly id: number;
  readonly name: string;
  readonly created_at: Date;
  readonly updated_at: Date;
}
```

Use `readonly` to prevent accidental mutations.

## 🔄 Transactions

For operations that need transactions, use `getClient()`:

```typescript
import { getClient } from '../config/database.js';

export const transferFunds = async (fromId: number, toId: number, amount: number) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
    await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
```

## 🧪 Testing Repositories

When testing repositories:
- Use a test database
- Clean up test data after tests
- Test both success and error cases
- Mock database if needed for unit tests

## 🔗 Related Files

- **Database Config** (`config/database.ts`) - Provides `query()` and `getClient()` functions
- **Services** (`services/`) - Call repository functions to access data


