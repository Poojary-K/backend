# Fund Management Backend API

A RESTful backend API built with Express.js and TypeScript for managing funds, causes, contributions, and members. This project follows a clean layered architecture pattern for maintainability and scalability.

## 🏗️ Project Overview

This backend service provides APIs for:
- **Authentication**: User registration and login with JWT tokens
- **Members**: Member management and profiles
- **Causes**: Fundraising cause creation and management
- **Contributions**: Tracking contributions made by members
- **Funds**: Aggregated fund status and summaries

## 🚀 Tech Stack

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Validation**: Zod
- **Security**: Helmet
- **Testing**: Jest with Supertest
- **Migrations**: node-pg-migrate

## 📁 Project Structure

```
backend/
├── src/                    # Source code directory
│   ├── app.ts             # Express app configuration
│   ├── server.ts          # Server entry point
│   ├── config/            # Configuration files
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic layer
│   ├── repositories/      # Data access layer
│   ├── routes/            # API route definitions
│   ├── middlewares/       # Express middlewares
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   └── tests/             # Test files
├── migrations/            # Database migration files
├── dist/                  # Compiled JavaScript output
└── db/                    # Database related files
```

## 🏃 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (create a `.env` file):
   ```env
   PORT=4000
   DATABASE_URL=postgres://user:password@localhost:5432/funds
   JWT_SECRET=your-secret-key-change-in-production
   JWT_EXPIRES_IN=1h
   BCRYPT_SALT_ROUNDS=10
   ```

4. Run database migrations:
   ```bash
   npm run migrate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run migrate` - Run database migrations
- `npm run migrate:down` - Rollback last migration

## 🏛️ Architecture

This project follows a **layered architecture** pattern:

1. **Routes** → Define API endpoints and HTTP methods
2. **Controllers** → Handle HTTP requests/responses, input validation
3. **Services** → Contain business logic and orchestration
4. **Repositories** → Handle database queries and data access
5. **Database** → PostgreSQL database

### Request Flow

```
HTTP Request → Route → Middleware → Controller → Service → Repository → Database
                                                                    ↓
HTTP Response ← Route ← Middleware ← Controller ← Service ← Repository ← Database
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Protected routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

## 📚 API Endpoints

- `/api/auth/*` - Authentication endpoints
- `/api/members/*` - Member management
- `/api/causes/*` - Cause management
- `/api/contributions/*` - Contribution tracking
- `/api/funds/*` - Fund status and summaries

## 🧪 Testing

Run tests with:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## 📖 Documentation

Each folder contains a README.md file explaining its purpose and structure. See:
- [src/README.md](src/README.md) - Source code structure
- [src/controllers/README.md](src/controllers/README.md) - Controllers documentation
- [src/services/README.md](src/services/README.md) - Services documentation
- And more...

## 🤝 Contributing

1. Follow the existing code structure and patterns
2. Write tests for new features
3. Ensure all tests pass before submitting
4. Follow TypeScript best practices
5. Use meaningful commit messages

## 📄 License

ISC



