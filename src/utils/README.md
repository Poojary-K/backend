# Utils Directory (`utils/`)

This directory contains reusable utility functions used throughout the application. These are pure functions that don't depend on Express or database connections.

## 📁 Files

- `jwt.ts` - JSON Web Token utilities (signing and verification)
- `password.ts` - Password hashing and verification utilities

## 🎯 Purpose

Utilities provide:
1. **Reusable functions** - Common operations used across the codebase
2. **Pure functions** - No side effects, easy to test
3. **Domain-specific helpers** - JWT, password hashing, etc.
4. **Abstraction** - Hide implementation details of third-party libraries

## 📝 Utility Pattern

Utilities are typically pure functions:

```typescript
export const utilityFunction = (input: Input): Output => {
  // Pure function logic
  return result;
};
```

## 🔍 Files Overview

### `jwt.ts`
**Purpose**: JWT token creation and verification.

**Functions**:
- `signToken(payload)`: Creates a JWT token with user payload
- `verifyToken(token)`: Verifies and decodes a JWT token

**Usage**:
```typescript
import { signToken, verifyToken } from '../utils/jwt.js';

// Sign a token
const token = signToken({ id: userId, email: userEmail });

// Verify a token
try {
  const payload = verifyToken(token);
  // payload contains { id, email, iat, exp }
} catch (error) {
  // Token is invalid or expired
}
```

**Configuration**:
- Uses `JWT_SECRET` from environment config
- Uses `JWT_EXPIRES_IN` from environment config

### `password.ts`
**Purpose**: Password hashing and verification using bcrypt.

**Functions**:
- `hashPassword(password)`: Hashes a plain text password
- `comparePassword(password, hash)`: Compares plain password with hash

**Usage**:
```typescript
import { hashPassword, comparePassword } from '../utils/password.js';

// Hash password (during registration)
const hashedPassword = await hashPassword('plainPassword123');

// Verify password (during login)
const isValid = await comparePassword('plainPassword123', hashedPassword);
if (isValid) {
  // Password matches
}
```

**Configuration**:
- Uses `BCRYPT_SALT_ROUNDS` from environment config (default: 10)

## 🔐 Security Considerations

### JWT Tokens
- **Never expose secret**: Keep `JWT_SECRET` secure
- **Token expiration**: Tokens expire based on `JWT_EXPIRES_IN`
- **HTTPS in production**: Always use HTTPS to prevent token interception

### Password Hashing
- **Never store plain passwords**: Always hash before storing
- **Salt rounds**: Higher rounds = more secure but slower (10 is recommended)
- **Timing attacks**: `comparePassword` uses constant-time comparison

## 📋 Creating New Utilities

When creating new utilities:

1. **Keep them pure** - No side effects, no dependencies on Express/DB
2. **Make them testable** - Easy to unit test
3. **Document usage** - Add JSDoc comments
4. **Handle errors** - Throw meaningful errors

Example:
```typescript
/**
 * Formats a date to ISO string
 * @param date - Date to format
 * @returns ISO formatted date string
 */
export const formatDate = (date: Date): string => {
  if (!(date instanceof Date)) {
    throw new Error('Invalid date');
  }
  return date.toISOString();
};
```

## 🧪 Testing Utilities

Utilities should be thoroughly tested:

```typescript
describe('hashPassword', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('password123');
    expect(hash).not.toBe('password123');
    expect(hash.length).toBeGreaterThan(0);
  });
  
  it('should produce different hashes for same password', async () => {
    const hash1 = await hashPassword('password123');
    const hash2 = await hashPassword('password123');
    expect(hash1).not.toBe(hash2); // Different salts
  });
});
```

## 🔗 Related Files

- **Auth Middleware** (`middlewares/authMiddleware.ts`) - Uses `verifyToken`
- **Auth Service** (`services/authService.ts`) - Uses `signToken` and password utilities
- **Config** (`config/env.ts`) - Provides configuration for utilities


