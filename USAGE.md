# API Usage Guide - Postman

This guide explains how to use all API endpoints using Postman or any HTTP client.

## 📋 Table of Contents

- [Setup](#setup)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Member Endpoints](#member-endpoints)
  - [Cause Endpoints](#cause-endpoints)
  - [Contribution Endpoints](#contribution-endpoints)
  - [Fund Endpoints](#fund-endpoints)
- [Error Responses](#error-responses)
- [Postman Collection Setup](#postman-collection-setup)

---

## Setup

### Prerequisites

1. **Start the server**:
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:4000` by default (or the PORT specified in your `.env`)

2. **Database must be set up**:
   ```bash
   npm run migrate
   ```

3. **Postman** (or any HTTP client like curl, Insomnia, etc.)

---

## Base URL

```
http://localhost:4000/api
```

All endpoints are prefixed with `/api`

---

## Authentication

Most endpoints require JWT authentication. Follow these steps:

### Step 1: Register or Login

First, register a new member or login to get a JWT token.

### Step 2: Use the Token

For protected endpoints, add the token to the request headers:

```
Authorization: Bearer <your-jwt-token>
```

**In Postman:**
1. Go to the **Authorization** tab
2. Select **Bearer Token** from the Type dropdown
3. Paste your token in the Token field

**Or manually in Headers:**
- Key: `Authorization`
- Value: `Bearer <your-jwt-token>`

---

## API Endpoints

### Authentication Endpoints

#### 1. Register a New Member

**Endpoint:** `POST /api/auth/register`

**Authentication:** Not required

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "1234567890",
  "password": "password123",
  "adminSecretCode": "your-admin-secret-code"
}
```

**Field Requirements:**
- `name` (required): String, minimum 1 character
- `email` (optional): Valid email format
- `phone` (optional): String, maximum 15 characters
- `password` (required): String, minimum 8 characters
- `adminSecretCode` (optional): If provided and matches `ADMIN_SECRET_CODE` from environment, user will be registered as admin

**Example Request (Postman):**
- Method: `POST`
- URL: `http://localhost:4000/api/auth/register`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "1234567890",
  "password": "password123"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "memberId": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "1234567890",
    "joinedOn": "2024-01-15",
    "isAdmin": false,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Note:** If `adminSecretCode` is provided and matches the server's `ADMIN_SECRET_CODE`, `isAdmin` will be `true`.

**Error Responses:**
- `400`: Validation error (invalid email format, password too short, etc.)
- `409`: Email already registered

---

#### 2. Login

**Endpoint:** `POST /api/auth/login`

**Authentication:** Not required

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "password123"
}
```

**Field Requirements:**
- `email` (required): Valid email format
- `password` (required): String, minimum 8 characters

**Example Request (Postman):**
- Method: `POST`
- URL: `http://localhost:4000/api/auth/login`
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "email": "john.doe@example.com",
  "password": "password123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "member": {
      "memberId": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "1234567890",
      "joinedOn": "2024-01-15",
      "isAdmin": false
    }
  }
}
```

**Error Responses:**
- `400`: Validation error (invalid email format, etc.)
- `401`: Invalid credentials (wrong email or password)

---

#### 3. Upgrade to Admin

**Endpoint:** `POST /api/auth/upgrade-to-admin`

**Authentication:** Required (Bearer Token)

**Request Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "adminSecretCode": "your-admin-secret-code"
}
```

**Field Requirements:**
- `adminSecretCode` (required): Must match `ADMIN_SECRET_CODE` from environment variables

**Example Request (Postman):**
- Method: `POST`
- URL: `http://localhost:4000/api/auth/upgrade-to-admin`
- Authorization: Bearer Token (paste your token)
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "adminSecretCode": "your-admin-secret-code"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "member": {
      "memberId": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "1234567890",
      "joinedOn": "2024-01-15",
      "isAdmin": true
    }
  }
}
```

**Note:** A new token is returned with updated `isAdmin` status. Use this new token for subsequent requests.

**Error Responses:**
- `400`: Member is already an admin
- `403`: Invalid admin secret code
- `401`: Missing or invalid token
- `404`: Member not found

---

### Member Endpoints

#### 3. List All Members

**Endpoint:** `GET /api/members`

**Authentication:** Required (Bearer Token)

**Request Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Example Request (Postman):**
- Method: `GET`
- URL: `http://localhost:4000/api/members`
- Authorization: Bearer Token (paste your token)

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "memberid": 1,
        "name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "1234567890",
        "password": "[REDACTED]",
        "joinedon": "2024-01-15T00:00:00.000Z"
      },
      {
        "memberid": 2,
        "name": "Jane Smith",
        "email": "jane.smith@example.com",
        "phone": "9876543210",
        "password": "[REDACTED]",
        "joinedon": "2024-01-16T00:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- `401`: Missing or invalid token

---

### Cause Endpoints

#### 4. Create a Cause

**Endpoint:** `POST /api/causes`

**Authentication:** Required (Bearer Token)

**Request Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Help Build a School",
  "description": "We need funds to build a new school in rural area",
  "amount": 50000
}
```

**Field Requirements:**
- `title` (required): String, minimum 1 character
- `description` (optional): String, maximum 1000 characters
- `amount` (optional): Number, must be non-negative

**Example Request (Postman):**
- Method: `POST`
- URL: `http://localhost:4000/api/causes`
- Authorization: Bearer Token
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "title": "Help Build a School",
  "description": "We need funds to build a new school in rural area",
  "amount": 50000
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "causeid": 1,
    "title": "Help Build a School",
    "description": "We need funds to build a new school in rural area",
    "amount": "50000.00",
    "createdat": "2024-01-20T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Validation error (title too short, description too long, negative amount)
- `401`: Missing or invalid token

---

#### 5. List All Causes

**Endpoint:** `GET /api/causes`

**Authentication:** Not required

**Example Request (Postman):**
- Method: `GET`
- URL: `http://localhost:4000/api/causes`

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "causes": [
      {
        "causeid": 1,
        "title": "Help Build a School",
        "description": "We need funds to build a new school in rural area",
        "amount": "50000.00",
        "createdat": "2024-01-20T10:30:00.000Z"
      },
      {
        "causeid": 2,
        "title": "Medical Emergency Fund",
        "description": "Support for emergency medical expenses",
        "amount": "25000.00",
        "createdat": "2024-01-21T14:20:00.000Z"
      }
    ]
  }
}
```

---

### Contribution Endpoints

#### 6. Create a Contribution

**Endpoint:** `POST /api/contributions`

**Authentication:** Required (Bearer Token)

**Request Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "memberId": 1,
  "amount": 1000,
  "contributedDate": "2024-01-20"
}
```

**Field Requirements:**
- `memberId` (required): Integer, positive number
- `amount` (required): Number, must be positive
- `contributedDate` (required): Valid date string (ISO format or YYYY-MM-DD)

**Example Request (Postman):**
- Method: `POST`
- URL: `http://localhost:4000/api/contributions`
- Authorization: Bearer Token
- Headers: `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "memberId": 1,
  "amount": 1000,
  "contributedDate": "2024-01-20"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "contributionid": 1,
    "memberid": 1,
    "amount": "1000.00",
    "contributeddate": "2024-01-20",
    "createdat": "2024-01-20T15:45:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Validation error (invalid memberId, negative amount, invalid date)
- `401`: Missing or invalid token

---

#### 7. List All Contributions

**Endpoint:** `GET /api/contributions`

**Authentication:** Required (Bearer Token)

**Example Request (Postman):**
- Method: `GET`
- URL: `http://localhost:4000/api/contributions`
- Authorization: Bearer Token

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "contributions": [
      {
        "contributionid": 1,
        "memberid": 1,
        "amount": "1000.00",
        "contributeddate": "2024-01-20",
        "createdat": "2024-01-20T15:45:00.000Z"
      },
      {
        "contributionid": 2,
        "memberid": 2,
        "amount": "500.00",
        "contributeddate": "2024-01-21",
        "createdat": "2024-01-21T10:30:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- `401`: Missing or invalid token

---

### Fund Endpoints

#### 8. Get Fund Status

**Endpoint:** `GET /api/funds/status`

**Authentication:** Not required

**Example Request (Postman):**
- Method: `GET`
- URL: `http://localhost:4000/api/funds/status`

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalcontributions": "1500.00",
    "totaldonations": "75000.00",
    "availablefunds": "-73500.00"
  }
}
```

**Response Fields:**
- `totalcontributions`: Sum of all contributions made
- `totaldonations`: Sum of all cause amounts (target donations)
- `availablefunds`: Total contributions minus total donations (can be negative)

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message",
  "details": "Additional error details (if available)"
}
```

### Common HTTP Status Codes:

- **400 Bad Request**: Validation errors, invalid input
- **401 Unauthorized**: Missing or invalid authentication token
- **409 Conflict**: Resource already exists (e.g., email already registered)
- **500 Internal Server Error**: Server-side errors

### Validation Error Example:
```json
{
  "success": false,
  "message": "Request validation failed",
  "details": [
    {
      "code": "invalid_string",
      "path": ["email"],
      "message": "Invalid email address"
    },
    {
      "code": "too_small",
      "path": ["password"],
      "message": "String must contain at least 8 character(s)"
    }
  ]
}
```

### Authentication Error Example:
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "details": "Token verification failed"
}
```

---

## Postman Collection Setup

### Step 1: Create a New Collection

1. Open Postman
2. Click **New** → **Collection**
3. Name it "Fund Management API"

### Step 2: Set Collection Variables

1. Click on your collection
2. Go to **Variables** tab
3. Add these variables:
   - `base_url`: `http://localhost:4000/api`
   - `token`: (leave empty, will be set after login)

### Step 3: Create Environment (Optional but Recommended)

1. Click the gear icon (⚙️) → **Manage Environments**
2. Click **Add**
3. Name it "Local Development"
4. Add variables:
   - `base_url`: `http://localhost:4000/api`
   - `token`: (leave empty)

### Step 4: Use Variables in Requests

Instead of hardcoding URLs, use:
- URL: `{{base_url}}/auth/login`
- Authorization Token: `{{token}}`

### Step 5: Auto-Save Token After Login

1. Create the login request
2. Go to **Tests** tab
3. Add this script to save the token automatically:

```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    if (jsonData.success && jsonData.data.token) {
        pm.environment.set("token", jsonData.data.token);
        // Or for collection variable:
        // pm.collectionVariables.set("token", jsonData.data.token);
        console.log("Token saved successfully");
    }
}
```

### Step 6: Organize Requests

Create folders in your collection:
- **Authentication** (register, login)
- **Members** (list members)
- **Causes** (create cause, list causes)
- **Contributions** (create contribution, list contributions)
- **Funds** (get fund status)

---

## Complete Workflow Example

### 1. Register a New Member
```
POST {{base_url}}/auth/register
Body: {
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```
**Save the token from response**

### 2. Login (Alternative)
```
POST {{base_url}}/auth/login
Body: {
  "email": "john@example.com",
  "password": "password123"
}
```
**Save the token from response**

### 3. Create a Cause
```
POST {{base_url}}/causes
Authorization: Bearer {{token}}
Body: {
  "title": "School Building",
  "description": "Help build a school",
  "amount": 50000
}
```

### 4. Create a Contribution
```
POST {{base_url}}/contributions
Authorization: Bearer {{token}}
Body: {
  "memberId": 1,
  "amount": 1000,
  "contributedDate": "2024-01-20"
}
```

### 5. Check Fund Status
```
GET {{base_url}}/funds/status
```

### 6. List All Causes
```
GET {{base_url}}/causes
```

### 7. List All Contributions
```
GET {{base_url}}/contributions
Authorization: Bearer {{token}}
```

### 8. List All Members
```
GET {{base_url}}/members
Authorization: Bearer {{token}}
```

---

## Tips & Best Practices

1. **Save Token Automatically**: Use Postman's Tests tab to auto-save tokens after login
2. **Use Variables**: Store base URL and token in environment/collection variables
3. **Organize Requests**: Group related endpoints in folders
4. **Test Error Cases**: Try invalid inputs to see error responses
5. **Check Headers**: Ensure `Content-Type: application/json` is set for POST requests
6. **Token Expiration**: Tokens expire after 1 hour (default). Re-login if you get 401 errors
7. **Date Format**: Use ISO format (YYYY-MM-DD) for dates

---

## Troubleshooting

### "Authorization header missing" (401)
- Make sure you're including the `Authorization` header
- Format: `Bearer <token>` (with space after Bearer)
- Check if token has expired (default: 1 hour)

### "Invalid email address" (400)
- Ensure email follows valid format: `user@domain.com`
- Check for extra spaces (use `.trim()` in your input)

### "Password too short" (400)
- Password must be at least 8 characters

### "Email already registered" (409)
- Use a different email or login with existing credentials

### Connection Refused
- Make sure the server is running (`npm run dev`)
- Check if the port matches your `.env` file (default: 4000)
- Verify the base URL is correct

---

## Quick Reference

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/register` | POST | No | Register new member (can include adminSecretCode) |
| `/api/auth/login` | POST | No | Login and get token |
| `/api/auth/upgrade-to-admin` | POST | Yes | Upgrade existing user to admin |
| `/api/members` | GET | Yes | List all members |
| `/api/causes` | GET | No | List all causes |
| `/api/causes` | POST | Yes | Create a cause |
| `/api/contributions` | GET | Yes | List all contributions |
| `/api/contributions` | POST | Yes | Create a contribution |
| `/api/funds/status` | GET | No | Get fund status summary |

---

Happy Testing! 🚀


