# RAG Chatbot Frontend — Architecture Explanation

> **Revision note:** This version corrects Section 16 (Admin Dashboard). The
> previous draft left the door open to "extending the backend contract" for
> dashboard stats. That endpoint does not exist and has not been scoped or
> built. This revision removes that ambiguity: the dashboard is now scoped
> strictly to what the four real endpoints can actually produce. Nothing is
> invented on the frontend to compensate for a missing backend feature.

This document explains how the planned `frontend/` folder structure works
with the **existing, already-implemented** backend endpoints and the Phase 11
frontend architecture.

## 1. High-Level Architecture

```text
Next.js Frontend
       |
       v
Express Backend
       |
       +-------------------+
       |                   |
     MongoDB             Redis
                           |
                           v
                       Python AI
                           |
                    LangGraph + ChromaDB
```

The frontend does not communicate directly with the Python AI service.

The frontend communicates with the Express backend through the backend API.
The backend communicates with Python through Redis Pub/Sub.

---

## 2. Frontend Folder Structure

```text
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── admin/
│       ├── layout.tsx
│       ├── login/page.tsx
│       ├── page.tsx
│       └── documents/page.tsx
├── components/
│   ├── ui/
│   ├── chat/
│   │   ├── chat-window.tsx
│   │   ├── message-bubble.tsx
│   │   ├── typing-indicator.tsx
│   │   ├── source-card.tsx
│   │   ├── suggested-questions.tsx
│   │   └── document-picker.tsx
│   ├── admin/
│   │   ├── dashboard-stats.tsx
│   │   ├── document-table.tsx
│   │   ├── document-upload-dropzone.tsx
│   │   └── status-badge.tsx
│   └── shared/
│       ├── markdown-renderer.tsx
│       └── error-banner.tsx
├── hooks/
│   ├── use-chat.ts
│   ├── use-documents.ts
│   └── use-auth.ts
├── lib/
│   ├── api-client.ts
│   ├── session.ts
│   └── types.ts
└── providers/
    └── query-provider.tsx
```

---

# 3. `app/` — Routing Layer

Next.js App Router uses the `app/` directory to define routes.

| File | URL |
|---|---|
| `app/page.tsx` | `/` |
| `app/admin/login/page.tsx` | `/admin/login` |
| `app/admin/page.tsx` | `/admin` |
| `app/admin/documents/page.tsx` | `/admin/documents` |

The `app/` directory should mainly compose pages and layouts rather than
contain large amounts of business logic.

---

# 4. `app/layout.tsx` — Root Layout

`app/layout.tsx` is the root layout shared by the entire frontend.

Its planned responsibilities include:

- Global HTML/layout structure
- `QueryClientProvider`
- Global toaster

Conceptually:

```text
Root Layout
    |
    +-- QueryClientProvider
    |
    +-- Current Page
    |
    +-- Toaster
```

TanStack Query needs its provider above components that use React Query
hooks.

---

# 5. Public Chat — `/`

File:

```text
app/page.tsx
```

This is the public chatbot page.

The page composes the chat UI:

```text
app/page.tsx
      |
      v
ChatWindow
      |
      +-- DocumentPicker
      +-- MessageBubble
      +-- TypingIndicator
      +-- SourceCard
      +-- SuggestedQuestions
```

The public chat does not require admin authentication.

---

# 6. Chat Request Flow

When the user asks a question:

```text
User
 |
 v
ChatWindow
 |
 v
use-chat.ts
 |
 v
lib/api-client.ts
 |
 v
POST /api/chat/ask
 |
 v
Express Backend
 |
 v
Redis Pub/Sub
 |
 v
Python AI Service
 |
 v
LangGraph
 |
 +-- retrieve_context
 |
 +-- generate_answer
 |
 +-- generate_suggestions
 |
 v
Redis Pub/Sub
 |
 v
Express Backend
 |
 v
Frontend
```

The frontend is responsible for displaying the request state and response.
It does not execute PDF processing or RAG logic.

There is no server-side streaming in the current backend contract. The
frontend shows a real typing/loading indicator while the request is in
flight, then renders the complete answer once the single response arrives.
No fake chunked reveal is used.

---

# 7. `hooks/use-chat.ts`

`use-chat.ts` contains frontend chat state and behavior.

Its responsibilities are expected to include:

- Sending questions
- Maintaining local `messages[]`
- Managing `sessionId`
- Managing loading state
- Managing errors
- Handling the response
- Exposing suggested questions to the UI

Conceptually:

```text
ChatWindow
    |
    v
useChat()
    |
    v
api-client.ts
    |
    v
POST /api/chat/ask
```

The UI should not contain the complete API communication logic.

---

# 8. `lib/session.ts`

The backend uses `sessionId` for conversation history, and enforces a
one-`sessionId`-to-one-`documentId` binding for the life of that session
(a mismatched reuse returns `409`).

The frontend session helper is responsible for minting, reading, and
resetting a session **whenever the active document changes**.

Conceptually:

```text
documentId
    |
    v
session.ts
    |
    v
sessionId
```

This allows a conversation to remain associated with the selected document,
and guarantees the frontend never triggers the backend's `409` session/doc
conflict by switching documents mid-session.

---

# 9. Chat History

Endpoint:

```text
GET /api/chat/:sessionId/history
```

Flow:

```text
Chat page
    |
    v
use-chat.ts
    |
    v
session.ts
    |
    v
GET /api/chat/:sessionId/history
    |
    v
Express
    |
    v
MongoDB
    |
    v
Chat history
    |
    v
Frontend messages[]
```

This allows the current conversation to be restored from the backend.

Note: this endpoint requires an already-known `sessionId`. There is no
endpoint that lists all sessions, so this cannot be used to build any kind
of "all conversations" or "total sessions" view — only to restore one
specific, already-active session.

---

# 10. `components/chat/`

The chat components are presentation-focused UI pieces.

```text
components/chat/
├── chat-window.tsx
├── message-bubble.tsx
├── typing-indicator.tsx
├── source-card.tsx
├── suggested-questions.tsx
└── document-picker.tsx
```

### `chat-window.tsx`

Main chat container.

### `message-bubble.tsx`

Displays user and AI messages.

### `typing-indicator.tsx`

Displays loading/typing state while waiting for the answer. This reflects a
real pending request, not a simulated stream.

### `source-card.tsx`

Displays source document information returned by the AI/backend.

### `suggested-questions.tsx`

Displays generated follow-up questions.

### `document-picker.tsx`

Allows the user to select the document used by the chat. Selecting a
different document triggers `session.ts` to mint a new `sessionId` and
clears the current thread.

---

# 11. `lib/api-client.ts`

`api-client.ts` is the centralized HTTP communication layer.

Instead of every component calling `fetch()` independently:

```text
Component
    |
    v
Hook
    |
    v
api-client.ts
    |
    v
Express Backend
```

Expected responsibilities:

- Base API URL
- HTTP requests
- Bearer token attachment (read from `localStorage`)
- Response parsing
- Typed API errors, including the specific status codes the backend
  actually returns: `404`, `409`, `502`, `503`, `504`

Admin requests need the JWT:

```text
Authorization: Bearer <token>
```

The public chat does not require admin authentication.

---

# 12. `lib/types.ts`

This file contains frontend TypeScript types matching the **actual** backend
API contract — not an idealized or hoped-for one.

Examples of expected categories:

```text
LoginResponse
Document
ChatMessage
ChatResponse
Source
SuggestedQuestion
ApiError   // discriminated union over 404 | 409 | 502 | 503 | 504
```

The goal is to avoid spreading `any` throughout the frontend, and to avoid
the frontend silently assuming a response shape (or an endpoint) that the
backend doesn't actually provide.

---

# 13. Admin Authentication

Route:

```text
/admin/login
```

File:

```text
app/admin/login/page.tsx
```

Flow:

```text
Login Page
    |
    v
use-auth.ts
    |
    v
api-client.ts
    |
    v
POST /api/auth/login
    |
    v
Express
    |
    v
MongoDB
    |
    v
JWT response
    |
    v
Frontend token storage (localStorage)
```

The backend currently exposes:

```text
POST /api/auth/register
POST /api/auth/login
```

---

# 14. `hooks/use-auth.ts`

`use-auth.ts` manages frontend authentication behavior.

Expected responsibilities:

```text
login()
logout()
getToken()      // reads from localStorage
isAuthenticated
```

The hook should hide token-management details from UI components.

---

# 15. `app/admin/layout.tsx`

All admin routes are under:

```text
app/admin/
```

Therefore:

```text
/admin
/admin/documents
```

can share the admin layout.

Planned flow:

```text
User visits /admin/documents
          |
          v
admin/layout.tsx
          |
          v
Authentication check (client-side, reads localStorage token)
       /          valid   invalid
      |         |
      v         v
documents   /admin/login
```

The decided structure uses a client-side auth guard, consistent with the
localStorage-JWT decision (no Next.js middleware or cookie proxy involved).

---

# 16. Admin Dashboard — `/admin`

File:

```text
app/admin/page.tsx
```

The assignment spec asks for four dashboard numbers:

- Total Uploaded PDFs
- Total Chat Sessions
- Total Questions Asked
- Recent Uploaded Documents

**No dashboard-statistics endpoint exists in the current backend.** The only
relevant endpoints that exist are:

```text
GET /api/documents
GET /api/chat/:sessionId/history   (requires a known sessionId — cannot enumerate sessions)
```

This means, honestly, with the backend as it stands today:

| Metric | Derivable from existing endpoints? | Source |
|---|---|---|
| Total Uploaded PDFs | ✅ Yes | `GET /api/documents` → count / `pagination.total` |
| Recent Uploaded Documents | ✅ Yes | `GET /api/documents` → already sorted `createdAt: -1` |
| Total Chat Sessions | ❌ No | No endpoint lists distinct sessions |
| Total Questions Asked | ❌ No | No endpoint lists/counts all chat messages across sessions |

**Decision: the frontend will not invent a fake number, a fake endpoint, or
silently omit the metric without saying so.** `dashboard-stats.tsx` renders
the two real metrics normally, and renders the two unavailable metrics as an
explicit "Not available" / disabled state rather than a fabricated `0` or a
guessed value.

If the two missing metrics are required for full marks, that is a **backend
task** — a small new endpoint (e.g. `GET /api/admin/dashboard/stats` doing a
Mongo aggregation: `Document.countDocuments()`, distinct `sessionId` count
and total document count from `ChatMessage`) — to be scoped and built
separately, before the frontend dashboard is finalized. It is not solved by
frontend workarounds.

```text
Dashboard
    |
    +-- DashboardStats
            |
            +-- Total PDFs            (real)
            +-- Recent Documents      (real)
            +-- Total Chat Sessions   (unavailable — explicit empty state)
            +-- Total Questions Asked (unavailable — explicit empty state)
```

---

# 17. Documents Page — `/admin/documents`

File:

```text
app/admin/documents/page.tsx
```

UI:

```text
Documents Page
    |
    +-- DocumentUploadDropzone
    |
    +-- DocumentTable
            |
            +-- StatusBadge
            +-- Reprocess
            +-- Delete
```

Document-related API logic is handled by `use-documents.ts`.

---

# 18. Upload PDF

Endpoint:

```text
POST /api/documents/upload
```

Flow:

```text
DocumentUploadDropzone
        |
        v
use-documents.ts
        |
        v
api-client.ts
        |
        v
POST /api/documents/upload
        |
        v
Express Backend
        |
        +-- ImageKit
        +-- MongoDB
        +-- Redis
                 |
                 v
             Python AI
                 |
                 v
              ChromaDB
```

The frontend only uploads the PDF to the backend.

The frontend must not process PDFs, generate embeddings, or write directly
to ChromaDB.

---

# 19. List Documents

Endpoint:

```text
GET /api/documents
```

Flow:

```text
documents/page.tsx
        |
        v
use-documents.ts
        |
        v
GET /api/documents
        |
        v
api-client.ts
        |
        v
Express
        |
        v
MongoDB
        |
        v
documents[]
        |
        v
DocumentTable
```

TanStack Query is appropriate for caching and refetching document data,
including auto-refetch while any row is `PENDING`/`PROCESSING`.

---

# 20. Delete Document

Endpoint:

```text
DELETE /api/documents/:id
```

Flow:

```text
DocumentTable
      |
      v
use-documents.ts
      |
      v
DELETE /api/documents/:id
      |
      v
Express
      |
      +-- MongoDB
      |
      +-- Redis DELETE event
                    |
                    v
                Python AI
                    |
                    v
              Delete vectors
```

After successful deletion, the frontend should invalidate/refetch the
documents query.

---

# 21. Reprocess Document

Actual endpoint (as implemented — note the verb):

```text
GET /api/documents/:id/reprocess
```

> This is a `GET`, not a `POST`, in the current backend implementation. It
> is not RESTful, but the frontend must call it as a `GET` to match what
> actually exists — not as a `POST`, and not "fixed" silently on the
> frontend in a way that would break against the real API.

Flow:

```text
DocumentTable
      |
      v
use-documents.ts
      |
      v
GET /api/documents/:id/reprocess
      |
      v
Express
      |
      +-- MongoDB -> PENDING
      |
      +-- Redis REPROCESS
                  |
                  v
              Python AI
                  |
                  v
             PDF pipeline
                  |
                  v
              ChromaDB
                  |
                  v
          COMPLETED / FAILED
```

Document processing statuses are:

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

---

# 22. `hooks/use-documents.ts`

This is the document-management frontend logic layer.

Expected operations:

```text
list documents
upload document
delete document
reprocess document
```

Conceptually:

```text
DocumentTable
      |
      v
useDocuments()
      |
      +-- query: GET /api/documents
      +-- mutation: POST /api/documents/upload
      +-- mutation: DELETE /api/documents/:id
      +-- mutation: GET /api/documents/:id/reprocess
      |
      v
api-client.ts
```

TanStack Query handles server state and cache invalidation.

---

# 23. `components/admin/`

These are reusable admin UI components.

```text
components/admin/
├── dashboard-stats.tsx
├── document-table.tsx
├── document-upload-dropzone.tsx
└── status-badge.tsx
```

The components should focus on rendering and user interaction.

They should not contain duplicated API request code, and — per Section
16 — `dashboard-stats.tsx` must not silently fabricate the two metrics
that have no backing endpoint.

Preferred:

```text
DocumentTable
      |
      v
useDocuments()
```

rather than:

```text
DocumentTable
      |
      v
fetch("/api/documents")
```

---

# 24. `components/shared/`

Shared UI components:

```text
components/shared/
├── markdown-renderer.tsx
└── error-banner.tsx
```

### Markdown Renderer

AI answers can contain Markdown.

Flow:

```text
AI answer string
      |
      v
MarkdownRenderer
      |
      v
Formatted UI
```

### Error Banner

API errors can be converted into friendly messages.

The planned component specifically maps the **actual** backend/gateway
error codes:

```text
404   document not found
409   document not ready (COMPLETED expected) OR session/document conflict
502   AI error or empty/null answer
503   Redis publish failed
504   30s request timeout
```

to user-friendly copy — not a generic catch-all error string.

---

# 25. Complete Endpoint Map

This map lists **only endpoints that actually exist today.** No endpoint is
listed here on the assumption it will be added later.

## Authentication

```text
/admin/login
    |
    v
use-auth.ts
    |
    v
api-client.ts
    |
    v
POST /api/auth/login
```

```text
POST /api/auth/register
POST /api/auth/login
```

---

## Documents

```text
/admin/documents
       |
       v
use-documents.ts
       |
       +----------------------------+------------------------------+
       |             |              |                              |
       v             v              v                              v
GET /api/documents  POST upload   DELETE /:id           GET /:id/reprocess
```

Actual endpoints:

```text
POST   /api/documents/upload
GET    /api/documents
DELETE /api/documents/:id
GET    /api/documents/:id/reprocess
```

---

## Chat

```text
/
|
v
ChatWindow
|
v
use-chat.ts
|
+-------------------------------+
|                               |
v                               v
POST /api/chat/ask       GET /api/chat/:sessionId/history
```

---

## Not implemented (do not build frontend code against these)

```text
GET /api/admin/dashboard/stats     — does not exist
GET /api/chat/sessions             — does not exist, cannot enumerate sessions
GET /api/chat/questions/count      — does not exist
```

If any of these are needed for the assignment's dashboard requirement, they
must be designed and built on the backend first, as their own scoped
addition — not assumed into the frontend plan.

---

# 26. The Most Important Separation

Remember this rule:

```text
app/
    WHERE is the page?

components/
    WHAT does the user see?

hooks/
    WHAT does the frontend do?

lib/
    HOW does frontend communicate with backend?

providers/
    WHAT global services does the app provide?

Express Backend
    WHAT server-side operation happens?

Redis
    HOW does Node communicate with Python?

Python AI
    HOW is PDF/RAG/AI processing performed?
```

---

# 27. Complete Request Lifecycle

For almost every frontend endpoint, the pattern is:

```text
User Action
    |
    v
Page / Component
    |
    v
Hook
    |
    v
api-client.ts
    |
    v
Express Endpoint
    |
    v
Backend Service
    |
    +---- MongoDB
    |
    +---- Redis
              |
              v
          Python AI
              |
              v
          ChromaDB
    |
    v
API Response
    |
    v
Hook state / TanStack Query cache
    |
    v
Component re-render
    |
    v
User sees result
```

The key architectural rules are:

> **Frontend → Express → Redis → Python AI. Never Frontend → Python AI directly.**

> **Frontend code is only ever written against endpoints that actually
> exist in the backend today.** Any gap between the assignment spec and the
> real backend (currently: dashboard stats) is called out explicitly and
> resolved as a backend task, not papered over on the frontend.