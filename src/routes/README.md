# Routes Directory (`routes/`)

Routes define the API endpoints and map HTTP methods to controller handlers. They also apply middleware like authentication and validation.

## 📁 Files

- `index.ts` - Main router that combines all route modules
- `authRoutes.ts` - Authentication endpoints (`/api/auth/*`)
- `memberRoutes.ts` - Member management endpoints (`/api/members/*`)
- `causeRoutes.ts` - Cause management endpoints (`/api/causes/*`)
- `contributionRoutes.ts` - Contribution endpoints (`/api/contributions/*`)
- `fundRoutes.ts` - Fund status endpoints (`/api/funds/*`)

## 🎯 Purpose

Routes are responsible for:
1. **Defining endpoints** - URL paths and HTTP methods
2. **Mapping to controllers** - Connecting URLs to handler functions
3. **Applying middleware** - Authentication, validation, etc.
4. **Route organization** - Grouping related endpoints together

## 📝 Route Pattern

Routes follow this pattern:

```typescript
import { Router } from 'express';
import { handler1, handler2 } from '../controllers/controller.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();

// Public routes
router.get('/public', handler1);
router.post('/public', validateRequest(schema), handler2);

// Protected routes
router.get('/protected', authenticate, handler1);
router.post('/protected', authenticate, validateRequest(schema), handler2);

export default router;
```

## 🔍 Key Responsibilities

### ✅ DO in Routes:
- Define URL paths and HTTP methods
- Map routes to controller handlers
- Apply middleware (authentication, validation)
- Organize related endpoints
- Export router for use in main app

### ❌ DON'T in Routes:
- Implement business logic (that's services)
- Handle requests directly (that's controllers)
- Write database queries (that's repositories)
- Format responses (that's controllers)

## 📋 Example Route File

```typescript
import { Router } from 'express';
import { 
  createItem, 
  getItem, 
  updateItem, 
  deleteItem 
} from '../controllers/itemController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { itemSchema } from '../schemas/itemSchema.js';

const router = Router();

// Public routes
router.get('/:id', getItem);

// Protected routes (require authentication)
router.post('/', authenticate, validateRequest(itemSchema), createItem);
router.put('/:id', authenticate, validateRequest(itemSchema), updateItem);
router.delete('/:id', authenticate, deleteItem);

export default router;
```

## 🔐 Middleware Application

### Authentication
Protect routes that require authentication:
```typescript
router.get('/protected', authenticate, handler);
```

### Validation
Validate request body/query/params:
```typescript
router.post('/', validateRequest(schema), handler);
```

### Multiple Middlewares
Apply multiple middlewares in order:
```typescript
router.post('/', authenticate, validateRequest(schema), handler);
// Order: authenticate → validateRequest → handler
```

## 🌐 Route Registration

All routes are registered in `index.ts`:

```typescript
import { Router } from 'express';
import authRoutes from './authRoutes.js';
import itemRoutes from './itemRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/items', itemRoutes);

export default router;
```

Then mounted in `app.ts`:
```typescript
app.use('/api', routes);
```

Final URL: `/api/auth/login`, `/api/items/:id`, etc.

## 📊 HTTP Methods

Common HTTP methods used:

- `GET` - Retrieve data (idempotent, safe)
- `POST` - Create new resources
- `PUT` - Update/replace resources (idempotent)
- `PATCH` - Partial update
- `DELETE` - Delete resources (idempotent)

## 🎨 Route Naming Conventions

Follow RESTful conventions:

- `GET /items` - List all items
- `GET /items/:id` - Get single item
- `POST /items` - Create item
- `PUT /items/:id` - Update item
- `DELETE /items/:id` - Delete item

## 🧪 Testing Routes

When testing routes:
- Test all HTTP methods
- Test with and without authentication
- Test validation middleware
- Test error cases
- Use Supertest for integration tests

## 🔗 Related Files

- **Controllers** (`controllers/`) - Handler functions called by routes
- **Middlewares** (`middlewares/`) - Applied to routes
- **App** (`app.ts`) - Mounts routes to Express app



