# Source Code Directory (`src/`)

This directory contains all the source code for the backend application. The codebase follows a clean, layered architecture pattern for maintainability and separation of concerns.

## 📁 Directory Structure

```
src/
├── app.ts              # Express application setup and configuration
├── server.ts           # HTTP server entry point
├── config/             # Application configuration (env, database)
├── controllers/        # Request handlers (HTTP layer)
├── services/           # Business logic layer
├── repositories/       # Data access layer (database queries)
├── routes/             # API route definitions
├── middlewares/        # Express middleware functions
├── utils/              # Utility functions (JWT, password hashing)
├── types/              # TypeScript type definitions
└── tests/              # Test files
```

## 🏗️ Architecture Layers

### 1. Entry Points
- **`server.ts`**: Bootstraps the HTTP server and starts listening on the configured port
- **`app.ts`**: Configures the Express application with middleware and routes

### 2. Configuration (`config/`)
Contains application configuration and database connection setup. See [config/README.md](config/README.md) for details.

### 3. Routes (`routes/`)
Define API endpoints and HTTP methods. Routes delegate to controllers. See [routes/README.md](routes/README.md) for details.

### 4. Controllers (`controllers/`)
Handle HTTP requests and responses. They validate input, call services, and format responses. See [controllers/README.md](controllers/README.md) for details.

### 5. Services (`services/`)
Contain business logic and orchestrate operations between repositories. See [services/README.md](services/README.md) for details.

### 6. Repositories (`repositories/`)
Handle all database interactions and SQL queries. See [repositories/README.md](repositories/README.md) for details.

### 7. Middlewares (`middlewares/`)
Express middleware functions for authentication, error handling, and request validation. See [middlewares/README.md](middlewares/README.md) for details.

### 8. Utils (`utils/`)
Reusable utility functions like JWT token handling and password hashing. See [utils/README.md](utils/README.md) for details.

### 9. Types (`types/`)
TypeScript type definitions and type extensions. See [types/README.md](types/README.md) for details.

### 10. Tests (`tests/`)
Unit and integration tests. See [tests/README.md](tests/README.md) for details.

## 🔄 Request Flow Example

When a request comes in:

1. **Route** (`routes/`) matches the URL and HTTP method
2. **Middleware** (`middlewares/`) runs (authentication, validation, etc.)
3. **Controller** (`controllers/`) receives the request, validates input
4. **Service** (`services/`) executes business logic
5. **Repository** (`repositories/`) queries the database
6. Response flows back through the layers

## 📝 Code Style Guidelines

- Use TypeScript strict mode
- Follow the existing naming conventions
- Keep functions focused and single-purpose
- Use async/await for asynchronous operations
- Handle errors appropriately at each layer
- Write meaningful comments for complex logic

## 🚀 Development

- Source files are in TypeScript (`.ts`)
- Compiled output goes to `dist/` directory
- Use `npm run dev` for development with hot reload
- Use `npm run build` to compile TypeScript


