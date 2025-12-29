# Middlewares Directory (`middlewares/`)

Middlewares are Express middleware functions that execute between receiving a request and sending a response. They handle cross-cutting concerns like authentication, error handling, and request validation.

## 📁 Files

- `authMiddleware.ts` - JWT authentication middleware
- `errorHandler.ts` - Global error handling middleware
- `validateRequest.ts` - Request validation middleware using Zod

## 🎯 Purpose

Middlewares are responsible for:
1. **Request processing** - Modify or validate requests before they reach controllers
2. **Authentication** - Verify user identity and permissions
3. **Error handling** - Catch and format errors consistently
4. **Validation** - Validate request data before processing
5. **Cross-cutting concerns** - Logging, rate limiting, etc.

## 📝 Middleware Pattern

Middlewares follow this pattern:

```typescript
import type { Request, Response, NextFunction } from 'express';

export const middlewareName = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  try {
    // Process request
    // Modify req/res if needed
    next(); // Call next middleware/controller
  } catch (error) {
    next(error); // Pass error to error handler
  }
};
```

## 🔍 Files Overview

### `authMiddleware.ts`
**Purpose**: Authenticates requests using JWT tokens.

**What it does**:
- Extracts Bearer token from `Authorization` header
- Verifies token signature and expiration
- Attaches user payload to `req.user`
- Rejects requests with invalid/missing tokens

**Usage**:
```typescript
import { authenticate } from '../middlewares/authMiddleware.js';

router.get('/protected', authenticate, handler);
// req.user is now available in handler
```

**Error responses**:
- `401` - Missing authorization header
- `401` - Invalid token format
- `401` - Invalid or expired token

### `errorHandler.ts`
**Purpose**: Global error handling middleware.

**What it does**:
- Catches all errors from controllers/middlewares
- Formats error responses consistently
- Handles different error types (HttpError, Zod errors, etc.)
- Logs errors for debugging
- Sends appropriate HTTP status codes

**Usage**:
```typescript
// In app.ts (must be last middleware)
app.use(errorHandler);
```

**Error format**:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

### `validateRequest.ts`
**Purpose**: Validates request data using Zod schemas.

**What it does**:
- Validates `req.body`, `req.query`, or `req.params`
- Returns validation errors if data is invalid
- Passes validated data to controller

**Usage**:
```typescript
import { validateRequest } from '../middlewares/validateRequest.js';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

router.post('/', validateRequest(schema), handler);
```

## 🔐 Authentication Flow

```
Request → authenticate middleware → Controller
                ↓ (if valid)
         Sets req.user
                ↓ (if invalid)
         Calls next(error) → Error Handler
```

After `authenticate` middleware, controllers can access:
```typescript
const userId = req.user.id;
const userEmail = req.user.email;
```

## ⚠️ Error Handling Flow

```
Controller throws error → next(error) → errorHandler middleware → Response
```

Always use `next(error)` to pass errors to the error handler:
```typescript
try {
  // ... code ...
} catch (error) {
  next(error); // Don't throw, use next()
}
```

## 📋 Custom Middleware Example

To create a new middleware:

```typescript
import type { Request, Response, NextFunction } from 'express';

export const customMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Do something with req/res
  req.customProperty = 'value';
  
  // Call next() to continue
  next();
  
  // Or call next(error) to pass error
  // next(new Error('Something went wrong'));
};
```

## 🎨 Middleware Order Matters

Middleware executes in the order it's applied:

```typescript
router.post(
  '/endpoint',
  middleware1,  // Runs first
  middleware2,  // Runs second
  middleware3,  // Runs third
  handler       // Runs last
);
```

Common order:
1. Authentication (`authenticate`)
2. Validation (`validateRequest`)
3. Controller handler

## 🧪 Testing Middlewares

When testing middlewares:
- Test success cases
- Test error cases
- Test with invalid input
- Verify `req`/`res` modifications
- Test middleware chaining

## 🔗 Related Files

- **Routes** (`routes/`) - Apply middlewares to routes
- **Controllers** (`controllers/`) - Receive processed requests
- **Utils** (`utils/jwt.ts`) - Used by auth middleware






