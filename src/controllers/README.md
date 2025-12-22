# Controllers Directory (`controllers/`)

Controllers are the HTTP request handlers that sit between routes and services. They handle HTTP-specific concerns like request/response formatting, input validation, and error handling.

## 📁 Files

- `authController.ts` - Authentication endpoints (register, login)
- `memberController.ts` - Member management endpoints
- `causeController.ts` - Cause management endpoints
- `contributionController.ts` - Contribution tracking endpoints
- `fundController.ts` - Fund status and summary endpoints

## 🎯 Purpose

Controllers are responsible for:
1. **Receiving HTTP requests** from Express routes
2. **Validating input** using Zod schemas
3. **Calling service functions** to execute business logic
4. **Formatting HTTP responses** with appropriate status codes
5. **Error handling** by passing errors to the error middleware

## 📝 Controller Pattern

Each controller follows this pattern:

```typescript
export const handlerName = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Validate input (if needed)
    const payload = schema.parse(req.body);
    
    // 2. Call service
    const result = await serviceFunction(payload);
    
    // 3. Send response
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    // 4. Pass errors to error handler
    next(error);
  }
};
```

## 🔍 Key Responsibilities

### ✅ DO in Controllers:
- Parse and validate request data
- Extract data from `req.body`, `req.params`, `req.query`
- Call service functions
- Format responses consistently
- Handle HTTP status codes
- Pass errors to error middleware

### ❌ DON'T in Controllers:
- Write business logic (that goes in services)
- Write database queries (that goes in repositories)
- Access `req.user` directly without authentication middleware
- Send responses without proper error handling

## 📋 Example Controller

```typescript
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createItem } from '../services/itemService.js';

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const createItemHandler = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Validate input
    const payload = itemSchema.parse(req.body);
    
    // Call service
    const item = await createItem(payload);
    
    // Send response
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};
```

## 🔐 Authentication

Some controllers require authentication. The `req.user` object is populated by the `authenticate` middleware:

```typescript
// In route file, protect with middleware:
router.post('/protected', authenticate, protectedHandler);

// In controller, access user:
export const protectedHandler = async (req: Request, res: Response) => {
  const userId = req.user.id; // Available after authenticate middleware
  // ...
};
```

## 📊 Response Format

All controllers should return responses in this format:

```typescript
// Success response
{ success: true, data: <result> }

// Error responses are handled by error middleware
```

## 🧪 Testing Controllers

When testing controllers:
- Mock service functions
- Test input validation
- Test error handling
- Verify response format and status codes

## 🔗 Related Files

- **Routes** (`routes/`) - Define which controllers handle which endpoints
- **Services** (`services/`) - Contain the business logic called by controllers
- **Middlewares** (`middlewares/`) - Handle authentication and validation before controllers

