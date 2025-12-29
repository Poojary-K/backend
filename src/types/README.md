# Types Directory (`types/`)

This directory contains TypeScript type definitions and type extensions used throughout the application.

## 📁 Files

- `express.d.ts` - Express.js type extensions

## 🎯 Purpose

Types directory provides:
1. **Type extensions** - Extending third-party library types (like Express)
2. **Global types** - Types used across multiple modules
3. **Type declarations** - Declaring types for untyped modules

## 🔍 Files Overview

### `express.d.ts`
**Purpose**: Extends Express Request type to include custom properties.

**What it does**:
- Adds `user` property to Express `Request` type
- Makes `req.user` available throughout the application
- Type-safe access to authenticated user data

**Typical content**:
```typescript
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        // ... other user properties
      };
    }
  }
}
```

**Usage**:
After this declaration, you can use `req.user` in controllers/middlewares:

```typescript
import type { Request } from 'express';

export const handler = (req: Request) => {
  // TypeScript knows req.user exists
  const userId = req.user?.id;
  const email = req.user?.email;
};
```

## 📝 Adding New Types

### Global Types
If you need types used across multiple files:

```typescript
// types/common.d.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
```

### Extending Express Types
To add more properties to Express Request:

```typescript
// types/express.d.ts
import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      requestId?: string; // Example: for request tracking
    }
  }
}
```

### Module Declarations
For untyped JavaScript modules:

```typescript
// types/custom-module.d.ts
declare module 'custom-module' {
  export function doSomething(): void;
}
```

## 🎨 Type Best Practices

1. **Use interfaces for objects** - Better for extension
2. **Use types for unions/intersections** - More flexible
3. **Prefer `readonly`** - Immutability where possible
4. **Export types** - Make them reusable
5. **Document complex types** - Add JSDoc comments

Example:
```typescript
/**
 * Represents a user in the system
 */
export interface User {
  readonly id: number;
  readonly email: string;
  readonly createdAt: Date;
}

/**
 * User creation payload (without id and timestamps)
 */
export type CreateUserPayload = Omit<User, 'id' | 'createdAt'>;
```

## 🔗 Related Files

- **Controllers** (`controllers/`) - Use extended Express types
- **Middlewares** (`middlewares/`) - Use extended Express types
- **Repositories** (`repositories/`) - Define database record types

## 📚 TypeScript Configuration

Make sure `tsconfig.json` includes the types directory:

```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./src/types"]
  }
}
```






