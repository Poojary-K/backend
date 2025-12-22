# TODO - Future Improvements

This document lists all pending improvements and features that should be implemented in the future. These items are organized by priority and category.

## 🔴 High Priority (Should Do Soon)

### 2. Fix Test Expectation
**File:** `src/tests/funds.test.ts`
- **Issue:** Test expects `res.body` to be data directly, but controller returns `{ success: true, data: status }`
- **Fix:** Update test to expect `res.body.success` and `res.body.data`
- **Impact:** Tests are currently failing

### 5. Add Comprehensive Test Coverage
**Missing tests for:**
- Authentication endpoints (register, login, invalid credentials)
- Member endpoints (list members)
- Cause endpoints (create, list)
- Contribution endpoints (create, list)
- Error cases (validation errors, 401, 409, 404, etc.)
- Edge cases (empty lists, invalid IDs, etc.)
- Rate limiting behavior
- Foreign key validation

**Files to create:**
- `src/tests/auth.test.ts`
- `src/tests/members.test.ts`
- `src/tests/causes.test.ts`
- `src/tests/contributions.test.ts`
- `src/tests/middlewares.test.ts`

### 6. Add Database Indexes
**File:** `migrations/0005_add_indexes.cjs` (new migration)
- **Missing indexes on:**
  - `contributions.memberid` (foreign key, frequently queried)
  - `contributions.contributeddate` (for date-based queries)
  - `causes.createdat` (for sorting)
- **Impact:** Performance improvement for queries

### 7. Add CORS Configuration
**File:** `src/app.ts`
- **Issue:** No CORS middleware (may be needed for frontend)
- **Fix:** Add `cors` middleware if frontend is on different origin
- **Dependencies:** Need to install `cors` package
- **Note:** Only needed if frontend runs on different domain/port

### 8. Secure JWT Secret Handling
**File:** `src/config/env.ts`
- **Issue:** Default `JWT_SECRET` is `'dev-secret-change-me'`
- **Risk:** Security vulnerability in production
- **Fix:** 
  - Require JWT_SECRET in production (throw error if using default)
  - Add environment check: `if (process.env.NODE_ENV === 'production' && config.jwtSecret === 'dev-secret-change-me')`

### 9. Add Proper Logging System
**Files:** New logging utility, update `src/middlewares/errorHandler.ts`
- **Issue:** Only `console.error` for errors
- **Fix:** 
  - Add logging library (Winston, Pino, etc.)
  - Add log levels (info, warn, error, debug)
  - Log requests, responses, errors
  - Add request ID for tracing
- **Dependencies:** Install logging library (e.g., `winston` or `pino`)

---

## 🟡 Medium Priority (Nice to Have)

### 11. Missing CRUD Operations
**Missing endpoints:**
- `PUT /api/members/:id` - Update member profile
- `GET /api/members/:id` - Get single member by ID
- `PUT /api/causes/:id` - Update cause
- `DELETE /api/causes/:id` - Delete cause
- `GET /api/causes/:id` - Get single cause by ID
- `PUT /api/contributions/:id` - Update contribution
- `DELETE /api/contributions/:id` - Delete contribution
- `GET /api/contributions/:id` - Get single contribution by ID

**Files to update:**
- `src/routes/memberRoutes.ts`
- `src/routes/causeRoutes.ts`
- `src/routes/contributionRoutes.ts`
- `src/controllers/` (new handlers)
- `src/services/` (new service functions)
- `src/repositories/` (new repository functions)

### 12. Add Pagination
**All list endpoints:**
- `GET /api/members?page=1&limit=10`
- `GET /api/causes?page=1&limit=10`
- `GET /api/contributions?page=1&limit=10`

**Implementation:**
- Add query parameter validation (page, limit)
- Update repository functions to support LIMIT/OFFSET
- Return pagination metadata: `{ items, total, page, limit, totalPages }`

**Files to update:**
- All route files (add query validation)
- All controller files (handle pagination params)
- All service files (pass pagination to repositories)
- All repository files (add LIMIT/OFFSET to queries)

### 13. Add Filtering and Searching
**Features needed:**
- Filter contributions by member: `GET /api/contributions?memberId=1`
- Filter contributions by date range: `GET /api/contributions?startDate=2024-01-01&endDate=2024-01-31`
- Search causes by title: `GET /api/causes?search=school`
- Filter members by name/email: `GET /api/members?search=john`

**Files to update:**
- Route files (add query parameter schemas)
- Repository files (add WHERE clauses based on filters)

### 17. Add API Documentation (Swagger/OpenAPI)
**Files:** New swagger setup files
- **Issue:** No Swagger/OpenAPI documentation
- **Fix:** 
  - Add `swagger-jsdoc` and `swagger-ui-express`
  - Create API documentation annotations
  - Add `/api-docs` endpoint
- **Dependencies:** Install `swagger-jsdoc` and `swagger-ui-express`

### 18. Add Health Check Endpoint
**File:** `src/routes/healthRoutes.ts` (new)
- **Endpoint:** `GET /api/health`
- **Response:** `{ status: 'ok', timestamp: '...', database: 'connected' }`
- **Use case:** Monitoring, load balancer health checks

### 19. Add Password Reset Functionality
**New endpoints:**
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

**Implementation:**
- Generate reset tokens
- Store tokens with expiration
- Send email with reset link (requires email service)
- Validate token and update password

**Files to create:**
- `src/routes/authRoutes.ts` (add new routes)
- `src/services/passwordResetService.ts`
- `src/repositories/passwordResetRepository.ts`
- Migration for password_reset_tokens table

### 20. Add Email Verification
**New endpoints:**
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email

**Implementation:**
- Generate verification tokens on registration
- Send verification email
- Mark email as verified
- Optional: Require email verification before login

**Files to create:**
- Update `src/services/memberService.ts`
- `src/services/emailService.ts` (new)
- Migration to add `email_verified` column to members table

---

## 🟢 Low Priority (Future Enhancements)

### 21. Add Soft Deletes
**Implementation:**
- Add `deleted_at` column to all tables
- Update delete operations to set `deleted_at` instead of hard delete
- Filter out deleted records in queries
- Add `includeDeleted` query parameter for admin access

**Files to update:**
- All repository files
- Migration to add `deleted_at` columns

### 22. Add Audit Trail
**Implementation:**
- Add `created_by`, `updated_by`, `updated_at` columns
- Track who created/modified records
- Use `req.user` from authentication middleware

**Files to update:**
- All repository files
- Migration to add audit columns

### 23. Add File Upload Support
**New endpoints:**
- `POST /api/causes/:id/image` - Upload cause image
- `GET /api/causes/:id/image` - Get cause image

**Implementation:**
- Use `multer` for file uploads
- Store files in cloud storage (S3) or local filesystem
- Validate file types and sizes
- Generate thumbnails for images

**Dependencies:** Install `multer`, `@types/multer`

### 24. Add Email Notifications
**Features:**
- Send email when new contribution is made
- Send email when new cause is created
- Send weekly/monthly summaries

**Implementation:**
- Create `src/services/emailService.ts`
- Integrate with email service (SendGrid, AWS SES, etc.)
- Add email templates
- Queue emails for async processing

**Dependencies:** Install email service SDK

### 25. Add Caching
**Implementation:**
- Cache fund status (Redis)
- Cache causes list (with TTL)
- Cache member data
- Invalidate cache on updates

**Dependencies:** Install `redis`, `ioredis`

### 26. Configure Database Connection Pooling
**File:** `src/config/database.ts`
- **Current:** Using default pool settings
- **Fix:** Configure pool size, timeout, etc. based on load
- **Settings:** `max`, `min`, `idleTimeoutMillis`, `connectionTimeoutMillis`

### 27. Add Environment-Specific Configurations
**Files:** 
- `src/config/env.dev.ts`
- `src/config/env.staging.ts`
- `src/config/env.prod.ts`

**Implementation:**
- Separate configs for dev/staging/production
- Different logging levels
- Different rate limits
- Different database pools

### 28. Add Request ID/Tracing
**File:** `src/middlewares/requestId.ts` (new)
- **Implementation:**
  - Generate unique request ID for each request
  - Add to request headers
  - Include in all logs
  - Return in response headers

### 29. Add API Versioning
**Implementation:**
- Change routes from `/api/` to `/api/v1/`
- Prepare for future `/api/v2/` support
- Add version negotiation in headers

**Files to update:**
- `src/routes/index.ts`
- `src/app.ts`
- All route files

### 30. Add Contribution Business Rule Validations
**File:** `src/services/contributionService.ts`
- **Validations:**
  - Check if contribution date is in the future (reject or warn)
  - Add maximum amount validation
  - Add minimum amount validation
  - Check for duplicate contributions (same member, same date)

---

## 📝 Notes for Future AI Code Edits

### Code Style Guidelines
- Follow existing TypeScript patterns
- Use `readonly` for interfaces
- Use async/await for all async operations
- Handle errors with `next(error)` in controllers
- Use Zod schemas for validation
- Use parameterized queries for all database operations

### Testing Requirements
- Write tests for all new features
- Test both success and error cases
- Mock external dependencies (database, email service, etc.)
- Use Supertest for integration tests

### Migration Guidelines
- Always create new migration files (never modify existing ones)
- Test migrations up and down
- Include indexes in migrations
- Add comments explaining complex migrations

### Security Considerations
- Never expose sensitive data in responses
- Always validate and sanitize inputs
- Use parameterized queries (already done)
- Rate limit sensitive endpoints more strictly
- Log security events

### Performance Considerations
- Add indexes for frequently queried columns
- Use pagination for list endpoints
- Consider caching for expensive queries
- Monitor query performance

---

## ✅ Completed Items

1. ✅ Fixed duplicate authentication middleware
3. ✅ Added foreign key validation for memberId
4. ✅ Created .env.example file
10. ✅ Added foreign key error handling (code 23503)
14. ✅ Added rate limiting middleware
15. ✅ Refactored controllers to use validateRequest middleware
16. ✅ Added input sanitization using Zod (trim, etc.)

---

## 📋 Quick Reference

**Priority Levels:**
- 🔴 High Priority: Should be done soon (security, bugs, missing critical features)
- 🟡 Medium Priority: Nice to have (improves UX, adds useful features)
- 🟢 Low Priority: Future enhancements (nice-to-have features, optimizations)

**When implementing:**
1. Check if item is already completed
2. Follow existing code patterns
3. Write tests for new features
4. Update documentation if needed
5. Ensure non-breaking changes
6. Test thoroughly before committing



