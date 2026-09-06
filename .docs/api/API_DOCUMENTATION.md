# Backend API Documentation

**Base URL:** `/api`  
**Version:** 1.0.0  
**Content-Type:** `application/json` (except multipart/form-data for file uploads)

---

## Authentication Flow

### Token Types

| Token | Storage | Expiry | Purpose |
|-------|---------|--------|---------|
| **Access Token** | In-memory (client) / Authorization header | 15 minutes (config: `JWT_EXPIRES_IN`) | API authorization |
| **Refresh Token** | HttpOnly Cookie (Secure, SameSite) | 7 days (config: `JWT_REFRESH_EXPIRES_IN`) | Token renewal |

### Login Flow

1. `POST /api/auth/login` Returns `accessToken` in body + `refreshToken` as HttpOnly cookie
2. Client stores `accessToken` in memory, includes in `Authorization: Bearer <token>` header
3. On `401 Unauthorized` Client calls `POST /api/auth/refresh` (with cookie) Gets new `accessToken`
4. On logout `POST /api/auth/logout` clears cookie + revokes access token in Redis

### Token Revocation

- Access tokens revoked on logout via Redis key `token:revoked:{jti}` with TTL = token remaining TTL
- Refresh tokens invalidated by clearing `refreshTokenHash` in MongoDB
- Middleware checks Redis revocation list on each request (fail-open on Redis error)

---

## Common Response Format

### Success Response

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Validation error 1", "Validation error 2"]  // Only for validation errors
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (invalid/expired token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 409 | Conflict (duplicate, state conflict) |
| 410 | Gone (resource deleted during processing) |
| 422 | Unprocessable Entity (validation) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |
| 502 | Bad Gateway (AI service error) |
| 503 | Service Unavailable (AI service down) |
| 504 | Gateway Timeout (AI service timeout) |

---

## Pagination Conventions

**Query Parameters:**
- `page` (integer, default: 1, min: 1)
- `limit` (integer, default: 10 or 20, max: 50)

**Response Format:**
```json
{
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth/login` | 5 requests | 15 minutes |
| `POST /api/auth/register` | 5 requests | 15 minutes |
| `POST /api/chat/ask` | 10 requests | 1 minute |

Rate limit keyed by client IP. Returns `429 Too Many Requests` with `Retry-After` header.

---

## API Endpoints

---

### Authentication

#### POST `/api/auth/register`

**Purpose:** Register a new user account.

**Authentication:** None (public)

**Rate Limited:** Yes (5 req / 15 min)

**Request Body:**
```json
{
  "username": "string (min 3 chars)",
  "email": "string (valid email)",
  "password": "string (min 12 chars, must contain: uppercase, lowercase, number, special char)"
}
```

**Validation Rules:**
- Username: required, string, min 3 chars
- Email: required, valid email format
- Password: required, min 12 chars, must contain uppercase, lowercase, number, special character
- Role: must not be provided (auto-assigned "user")

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string",
      "role": "user"
    },
    "accessToken": "string (JWT)"
  }
}
```

**Response Cookies:**
- `refreshToken` (HttpOnly, Secure, SameSite, 7-day max-age)

**Error Responses:**
- `400` - Validation error or duplicate email/username
- `429` - Rate limited

---

#### POST `/api/auth/login`

**Purpose:** Authenticate user and issue tokens.

**Authentication:** None (public)

**Rate Limited:** Yes (5 req / 15 min)

**Request Body:**
```json
{
  "email": "string (valid email)",
  "password": "string (non-empty)"
}
```

**Validation Rules:**
- Email: required, valid email format
- Password: required, non-empty

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged in successfully.",
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string",
      "role": "user|admin"
    },
    "accessToken": "string (JWT)"
  }
}
```

**Response Cookies:**
- `refreshToken` (HttpOnly, Secure, SameSite, 7-day max-age)

**Error Responses:**
- `400` - Missing email/password
- `401` - Invalid credentials
- `429` - Rate limited

---

#### POST `/api/auth/refresh`

**Purpose:** Obtain new access token using refresh token.

**Authentication:** Via HttpOnly `refreshToken` cookie (or request body fallback)

**Rate Limited:** No

**Request Body (optional):**
```json
{
  "refreshToken": "string"  // optional fallback if cookie not sent
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Token refreshed successfully.",
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string",
      "role": "user|admin"
    },
    "accessToken": "string (new JWT)"
  }
}
```

**Response Cookies:**
- New `refreshToken` (HttpOnly, rotated, old invalidated)

**Error Responses:**
- `400` - Refresh token missing
- `401` - Invalid/expired refresh token, rotation failed
- Response clears `refreshToken` cookie on error

---

#### POST `/api/auth/logout`

**Purpose:** Revoke tokens and clear session.

**Authentication:** Required (`Authorization: Bearer <accessToken>`)

**Rate Limited:** No

**Request Headers:**
```
Authorization: Bearer <accessToken>
Cookie: refreshToken=<token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

**Behavior:**
- Revokes access token in Redis (key `token:revoked:{jti}` with TTL = token remaining TTL)
- Clears `refreshTokenHash` in MongoDB
- Clears `refreshToken` cookie

**Error Response:**
- `500` - Logout failed (but cookie still cleared)

---

### Documents (Admin Only)

All document endpoints require **authentication + admin role** (`requireAdmin` middleware).

#### POST `/api/documents/upload`

**Purpose:** Upload PDF document for processing.

**Authentication:** Required + Admin role

**Content-Type:** `multipart/form-data`

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | PDF file (max 15MB) |

**Validation:**
- File required
- Must be `application/pdf` (checked by Multer + validator)
- Max 15MB

**Processing:**
1. File uploaded to ImageKit
2. MongoDB document created with `processingStatus: "PENDING"`
3. Redis event published to `pdf_process_requests` stream
4. Python worker processes asynchronously

**Success Response (201):**
```json
{
  "success": true,
  "message": "PDF uploaded successfully. Processing started.",
  "data": {
    "_id": "string (ObjectId)",
    "fileName": "string",
    "filePath": "string (ImageKit URL)",
    "fileSize": 123456,
    "processingStatus": "PENDING",
    "uploadedBy": "string (ObjectId)",
    "currentOperationId": "string (UUID)",
    "processingVersion": 1,
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```

**Error Responses:**
- `400` - No file, wrong type, validation error
- `403` - Not admin
- `413` - File too large (>15MB)
- `500` - Upload/processing failure

---

#### GET `/api/documents`

**Purpose:** List documents with search and pagination.

**Authentication:** Required + Admin role

**Query Parameters:**
| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| search | string | - | - | Case-insensitive filename search |
| page | integer | 1 | - | Page number (min 1) |
| limit | integer | 10 | 50 | Items per page |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "_id": "string",
        "fileName": "string",
        "filePath": "string",
        "fileSize": 123456,
        "processingStatus": "PENDING|PROCESSING|COMPLETED|FAILED",
        "errorMessage": "string|null",
        "uploadedBy": { "username": "string", "email": "string" },
        "createdAt": "ISO8601",
        "updatedAt": "ISO8601"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10
    }
  }
}
```

---

#### DELETE `/api/documents/:id`

**Purpose:** Delete document and trigger Chroma cleanup.

**Authentication:** Required + Admin role

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| id | string (ObjectId) | Document ID |

**Validation:** Valid MongoDB ObjectId

**Behavior:**
1. Marks document with `currentOperationId` and increments `processingVersion`
2. Deletes from MongoDB
3. Publishes `DELETE` event to `pdf_process_requests` stream
4. Python worker deletes Chroma collection

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document deleted successfully."
}
```

**Error Responses:**
- `400` - Invalid ID format
- `403` - Not admin
- `404` - Document not found
- `500` - Deletion failed

---

#### POST `/api/documents/:id/reprocess`

**Purpose:** Reprocess existing document (regenerate embeddings).

**Authentication:** Required + Admin role

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| id | string (ObjectId) | Document ID |

**Validation:** Valid MongoDB ObjectId

**Behavior:**
1. Resets `processingStatus` to `PENDING`
2. Clears `errorMessage`
3. Increments `processingVersion`
4. Publishes `REPROCESS` event to stream

**Success Response (200):**
```json
{
  "success": true,
  "message": "Document sent for reprocessing.",
  "data": {
    "_id": "string",
    "processingStatus": "PENDING",
    "processingVersion": 2,
    "currentOperationId": "string (UUID)",
    ...
  }
}
```

**Error Responses:**
- `400` - Invalid ID
- `403` - Not admin
- `404` - Document not found

---

### Chat

All chat endpoints require **authentication** (no admin role required).

#### POST `/api/chat/ask`

**Purpose:** Ask a question about a processed document.

**Authentication:** Required

**Rate Limited:** Yes (10 req/min)

**Request Body:**
```json
{
  "sessionId": "string (1-100 chars)",
  "documentId": "string (valid ObjectId)",
  "question": "string (1-1000 chars)"
}
```

**Validation Rules:**
- `sessionId`: required, 1-100 chars
- `documentId`: required, valid ObjectId
- `question`: required, 1-1000 chars

**Processing Flow:**
1. Verify document exists and `processingStatus === "COMPLETED"`
2. Verify session not used with different document
3. Build conversation history (last 5 Q&A pairs)
4. Generate `requestId` (UUID)
5. Register pending request with 30s timeout
5. Publish to `pdf_chat_requests` Redis Stream
6. Wait for Python worker response via `pdf_chat_responses` Pub/Sub
7. Persist Q&A to MongoDB with sources

**Success Response (200):**
```json
{
  "success": true,
  "message": "Question answered successfully",
  "data": {
    "_id": "string",
    "sessionId": "string",
    "documentId": "string",
    "userId": "string",
    "question": "string",
    "answer": "string",
    "sources": [
      {
        "documentName": "string",
        "pageNumber": "number|null",
        "excerpt": "string",
        "similarity": "number"
      }
    ],
    "suggestedQuestions": ["string", ...],
    "requestId": "string (UUID)",
    "createdAt": "ISO8601"
  }
}
```

**Error Responses:**
- `400` - Validation error
- `403` - Session belongs to different document
- `404` - Document not found
- `409` - Document not ready (status != COMPLETED) / session conflict
- `410` - Document deleted during processing
- `502` - AI service error / invalid response
- `503` - AI service unavailable (Redis publish failed)
- `504` - Timeout (30s)

---

#### GET `/api/chat/:sessionId/history`

**Purpose:** Get paginated conversation history for a session.

**Authentication:** Required

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| sessionId | string | Session ID |

**Query Parameters:**
| Param | Type | Default | Max |
|-------|------|---------|-----|
| page | integer | 1 | - |
| limit | integer | 10 | 50 |

**Validation:** sessionId required, 1-100 chars

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "_id": "string",
        "sessionId": "string",
        "documentId": "string",
        "userId": "string",
        "question": "string",
        "answer": "string",
        "sources": [...],
        "suggestedQuestions": ["string"],
        "requestId": "string",
        "createdAt": "ISO8601"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  }
}
```

**Filtering:** Returns only messages where `sessionId` matches AND `userId` matches authenticated user.

---

#### GET `/api/chat/conversations`

**Purpose:** List all conversation sessions for current user.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Default | Max |
|-------|------|---------|-----|
| page | integer | 1 | - |
| limit | integer | 20 | - |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "sessionId": "string",
        "documentId": "string",
        "lastQuestion": "string",
        "lastAnswer": "string",
        "lastMessageAt": "ISO8601",
        "messageCount": 10
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

**Data Source:** MongoDB aggregation grouping by `sessionId` for authenticated user, sorted by `lastMessage.createdAt` descending.

---

## Webhook / Internal Events (Reference)

These are internal Redis streams, not HTTP endpoints.

### `pdf_process_requests` (Redis Stream)
Published by Node.js, consumed by Python worker.

**Event Types:**
```json
{
  "type": "process_pdf",
  "operationId": "uuid",
  "documentId": "string",
  "filePath": "string",
  "fileName": "string",
  "action": "PROCESS|REPROCESS|DELETE"
}
```

### `pdf_process_responses` (Pub/Sub Channel)
Published by Python, consumed by Node.js.

**Response Format:**
```json
{
  "type": "process_pdf_response",
  "documentId": "string",
  "status": "COMPLETED|FAILED",
  "operationId": "uuid|null",
  "chunksCreated": "number",
  "embeddingsGenerated": "number",
  "totalTokens": "number",
  "errorMessage": "string|null",
  "timestamp": "ISO8601"
}
```

### `pdf_chat_requests` (Redis Stream)
Published by Node.js, consumed by Python.

```json
{
  "type": "ask_question",
  "requestId": "uuid",
  "sessionId": "string",
  "documentId": "string",
  "question": "string",
  "conversationHistory": "[{\"role\":\"user\",\"content\":\"...\"},...]"
}
```

### `pdf_chat_responses` (Pub/Sub Channel)
Published by Python, consumed by Node.js.

```json
{
  "type": "ask_question_response",
  "requestId": "uuid",
  "answer": "string",
  "sources": [
    {"text": "...", "similarity": 0.9, "chunk_index": 0, "page_number": 1}
  ],
  "suggestedQuestions": ["string"],
  "error": "string|null",
  "timestamp": "ISO8601"
}
```

---

## Error Code Reference

### Auth Errors
| Code | Message | Cause |
|------|---------|-------|
| 400 | "Validation Error" | Missing/invalid fields |
| 401 | "Invalid or expired token" | JWT expired/malformed |
| 401 | "Invalid or expired refresh token" | Refresh token invalid |
| 401 | "Token has been revoked" | Access token revoked (logout) |
| 403 | "Forbidden. Admin access required." | Non-admin accessing admin route |
| 429 | "Too many requests. Please try again later." | Rate limit exceeded |

### Document Errors
| Code | Message | Cause |
|------|---------|-------|
| 400 | "Validation Error" | Invalid ID, file type, size |
| 404 | "Document not found" | ID not in DB |
| 409 | "Document is not ready" | Status != COMPLETED |
| 410 | "Document was deleted while processing" | Deleted during AI processing |
| 500 | "Upload failed" | ImageKit/Redis/Mongo error |

### Chat Errors
| Code | Message | Cause |
|------|---------|-------|
| 400 | "Validation Error" | Invalid sessionId/documentId/question |
| 404 | "Document not found" | ID not in DB |
| 409 | "Document is not ready" | Status != COMPLETED |
| 409 | "Session already associated with different document" | Session reused |
| 410 | "Document was deleted while processing" | Race condition |
| 502 | "AI service returned invalid answer" | Python worker error |
| 503 | "AI service temporarily unavailable" | Redis publish failed |
| 504 | "Request timed out" | 30s timeout exceeded |

---

## Frontend Integration Notes

### Login/Register Flow
```javascript
// Login
const res = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',  // Required for HttpOnly cookie
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { accessToken } = await res.json();
// Store accessToken in memory (not localStorage)

// Subsequent requests
fetch('/api/chat/ask', {
  headers: { 'Authorization': `Bearer ${accessToken}` },
  credentials: 'include'
});

// On 401 -> auto-refresh handled by api-client
```

### Auto-Refresh
The `api-client.ts` handles 401 -> refresh -> retry automatically. No manual handling needed.

### Page Reload
On reload, `useAuth` hook calls `/api/auth/refresh` via cookie to restore session.

### Logout
```javascript
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  credentials: 'include'
});
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-09-06 | Initial documentation |

---

*Generated from source code analysis. Last updated: 2026-09-06*