# Services Directory (`services/`)

Services contain the business logic layer of the application. They orchestrate operations between repositories and implement the core functionality of the application.

## 📁 Files

- `authService.ts` - Authentication business logic (registration, login)
- `memberService.ts` - Member management business logic
- `causeService.ts` - Cause management business logic
- `contributionService.ts` - Contribution tracking business logic
- `fundService.ts` - Fund aggregation and summary business logic

## 🎯 Purpose

Services are responsible for:
1. **Business logic** - Implementing application rules and workflows
2. **Orchestration** - Coordinating multiple repository calls
3. **Data transformation** - Converting between different data formats
4. **Validation** - Business-level validation (beyond input validation)
5. **Error handling** - Throwing domain-specific errors

## 📝 Service Pattern

Services typically follow this pattern:

```typescript
export const serviceFunction = async (params: Params): Promise<Result> => {
  // 1. Business logic validation
  // 2. Call repository functions
  // 3. Transform/process data
  // 4. Return result
};
```

## 🔍 Key Responsibilities

### ✅ DO in Services:
- Implement business rules and workflows
- Coordinate multiple repository calls
- Transform data between layers
- Handle business-level validation
- Throw domain-specific errors
- Implement complex operations that span multiple repositories

### ❌ DON'T in Services:
- Handle HTTP requests/responses (that's controllers)
- Write raw SQL queries (that's repositories)
- Access `req` or `res` objects
- Format HTTP responses

## 📋 Example Service

```typescript
import { getUserById, createUser } from '../repositories/userRepository.js';
import { hashPassword } from '../utils/password.js';

export const registerUser = async (data: RegisterData) => {
  // Business logic: Check if user exists
  const existingUser = await getUserByEmail(data.email);
  if (existingUser) {
    throw new Error('User already exists');
  }
  
  // Business logic: Hash password
  const hashedPassword = await hashPassword(data.password);
  
  // Call repository
  const user = await createUser({
    ...data,
    password: hashedPassword,
  });
  
  // Transform data (remove sensitive info)
  return {
    id: user.id,
    email: user.email,
    // Don't return password
  };
};
```

## 🔄 Service Relationships

```
Controller → Service → Repository → Database
```

- **Controllers** call services
- **Services** call repositories
- **Services** can call other services
- **Services** can call utilities

## 🎨 Common Service Patterns

### 1. CRUD Operations
```typescript
export const createItem = async (data) => { /* ... */ };
export const getItem = async (id) => { /* ... */ };
export const updateItem = async (id, data) => { /* ... */ };
export const deleteItem = async (id) => { /* ... */ };
```

### 2. Aggregation
```typescript
export const getSummary = async () => {
  const items = await repository.getAll();
  return {
    total: items.length,
    // ... aggregated data
  };
};
```

### 3. Complex Workflows
```typescript
export const processOrder = async (orderData) => {
  // Multiple steps
  const user = await getUser(orderData.userId);
  const items = await getItems(orderData.itemIds);
  const total = calculateTotal(items);
  const order = await createOrder({ ...orderData, total });
  await updateInventory(items);
  return order;
};
```

## 🧪 Testing Services

When testing services:
- Mock repository functions
- Test business logic thoroughly
- Test error cases
- Test data transformations
- Test complex workflows

## 🔗 Related Files

- **Controllers** (`controllers/`) - Call services to handle HTTP requests
- **Repositories** (`repositories/`) - Called by services to access data
- **Utils** (`utils/`) - Utility functions used by services


