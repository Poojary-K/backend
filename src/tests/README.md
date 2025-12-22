# Tests Directory (`tests/`)

This directory contains test files for the application. Tests ensure code quality, catch bugs early, and serve as documentation for how the code should work.

## 📁 Files

- `funds.test.ts` - Tests for fund-related functionality

## 🎯 Purpose

Tests provide:
1. **Quality assurance** - Verify code works as expected
2. **Regression prevention** - Catch bugs when refactoring
3. **Documentation** - Show how code should be used
4. **Confidence** - Enable safe refactoring and changes

## 🧪 Testing Framework

This project uses:
- **Jest** - Test runner and assertion library
- **Supertest** - HTTP assertion library for API testing
- **ts-jest** - TypeScript support for Jest

## 📝 Test File Structure

Tests follow this pattern:

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something', async () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

## 🔍 Test Types

### Unit Tests
Test individual functions in isolation:
```typescript
import { hashPassword } from '../utils/password.js';

describe('hashPassword', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('password123');
    expect(hash).not.toBe('password123');
  });
});
```

### Integration Tests
Test multiple components working together:
```typescript
import request from 'supertest';
import { createApp } from '../app.js';

describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
  });
});
```

## 📋 Test Organization

Organize tests to match source structure:

```
src/
├── controllers/
│   └── fundController.ts
├── services/
│   └── fundService.ts
└── tests/
    ├── controllers/
    │   └── fundController.test.ts
    └── services/
        └── fundService.test.ts
```

## ✅ Writing Good Tests

### DO:
- ✅ Test one thing per test
- ✅ Use descriptive test names
- ✅ Test both success and error cases
- ✅ Clean up test data
- ✅ Mock external dependencies
- ✅ Test edge cases

### DON'T:
- ❌ Test implementation details
- ❌ Write tests that depend on each other
- ❌ Leave test data in the database
- ❌ Test third-party libraries
- ❌ Write overly complex tests

## 🎨 Test Examples

### Controller Test
```typescript
import { getFundStatusHandler } from '../controllers/fundController.js';
import { getFundSummary } from '../services/fundService.js';

jest.mock('../services/fundService.js');

describe('getFundStatusHandler', () => {
  it('should return fund status', async () => {
    const mockStatus = { totalcontributions: '1000', totaldonations: '500', availablefunds: '500' };
    (getFundSummary as jest.Mock).mockResolvedValue(mockStatus);
    
    const req = {} as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();
    
    await getFundStatusHandler(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockStatus });
  });
});
```

### Service Test
```typescript
import { getFundSummary } from '../services/fundService.js';
import { getFundStatus } from '../repositories/fundRepository.js';

jest.mock('../repositories/fundRepository.js');

describe('getFundSummary', () => {
  it('should return fund status from repository', async () => {
    const mockStatus = { totalcontributions: '1000', totaldonations: '500', availablefunds: '500' };
    (getFundStatus as jest.Mock).mockResolvedValue(mockStatus);
    
    const result = await getFundSummary();
    
    expect(result).toEqual(mockStatus);
    expect(getFundStatus).toHaveBeenCalledTimes(1);
  });
});
```

## 🚀 Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## 🔧 Test Configuration

Jest configuration is in `jest.config.ts`. Key settings:
- Test environment: Node.js
- TypeScript support via ts-jest
- Test file patterns: `**/*.test.ts`

## 🧹 Test Cleanup

Always clean up after tests:
- Close database connections
- Clear test data
- Reset mocks
- Clean up temporary files

```typescript
afterEach(async () => {
  await cleanupTestData();
  jest.clearAllMocks();
});

afterAll(async () => {
  await closePool(); // Close database pool
});
```

## 🔗 Related Files

- **Jest Config** (`jest.config.ts`) - Jest configuration
- **Source Files** (`src/`) - Code being tested


