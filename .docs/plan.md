# RAG Chatbot Development Plan

## Objective
Build the assignment incrementally without skipping architecture.

- Follow a backend-first approach.
- Do NOT generate the entire project at once.
- Complete, test, and commit every phase before moving on.

---

## Tech Stack

### Frontend
- Next.js (App Router)
- TypeScript
- TailwindCSS
- shadcn/ui

### Backend
- Express.js
- TypeScript
- MongoDB
- Redis Pub/Sub

### AI Service
- Python
- FastAPI
- LangChain
- LangGraph
- ChromaDB

### Communication Flow
```text
Frontend
↓
Node Backend
↓
Redis Pub/Sub
↓
Python AI
↓
Redis Pub/Sub
↓
Node Backend
↓
Frontend
```

> Backend and Python AI MUST NEVER communicate directly.

---

## Development Rules
1. Build one feature at a time.
2. Never generate placeholder code.
3. Every module should be production-style.
4. Keep folder structure clean.
5. Keep files small.
6. Follow feature-based architecture.
7. After each phase, ensure the project still runs.

---

## Folder Structure
- project-root/
  - frontend/
  - backend/
  - python-ai/
  - shared/
  - docs/

---

## Phase 1 — Project Initialization

**Goal:** Setup complete repository.

**Tasks:**
- Initialize frontend
- Initialize backend
- Initialize python-ai
- Create shared folder
- Configure TypeScript
- Configure environment variables
- Configure `.gitignore`

**Deliverable:** Project boots successfully.

---

## Phase 2 — Backend Foundation

**Goal:** Create Express backend.

**Tasks:**
- Create folder structure:
  - `src/`
  - `config/`
  - `db/`
  - `middleware/`
  - `models/`
  - `modules/`
  - `redis/`
  - `app.ts`
  - `server.ts`
- Install dependencies:
  - Express
  - TypeScript
  - MongoDB
  - Redis
  - JWT
  - Multer
  - UUID

**Deliverable:** Backend server running.

---

## Phase 3 — Database

**Goal:** Connect MongoDB.

**Collections:**
- Users
- Documents
- Chats

**Requirements:**
- Create models
- Create database connection
- Test database integration

**Deliverable:** Mongo connected.

---

## Phase 4 — Redis

**Goal:** Setup Redis Pub/Sub.

**Create:**
- `publisher.ts`
- `subscriber.ts`
- `channels.ts`

**Channels:**
- `pdf_process_requests`
- `pdf_process_responses`
- `chat_requests`
- `chat_responses`

**Deliverable:** Redis publish/subscribe working.

---

## Phase 5 — Authentication

**Goal:** Admin authentication.

**APIs:**
- `Post /register`
- `POST /login`

**Requirements:**
- JWT authentication
- Middleware to protect admin routes

**Deliverable:** Login works.

---

## Phase 6 — Document Module

**Goal:** Knowledge base management.

**APIs:**
- Upload PDF `POST /api/documents/upload`
- List PDFs   `GET /api/documents`
- Delete PDF  `DELETE /api/documents/:id`
- Reprocess PDF  `POST /api/documents/:id/reprocess`

**Backend responsibilities:**
- Save PDF file
- Save metadata
- Publish Redis event

> DO NOT process PDF inside backend.

**Deliverable:** Backend publishes document processing request.

---

## Phase 7 — Python AI Setup

**Goal:** FastAPI service.

**Structure:**
- `main.py`
- `redis_worker.py`
- `graph/`
- `ingestion/`
- `vectorstore/`
- `config.py`

**Deliverable:** Python service running.

---

## Phase 8 — PDF Processing

**Goal:** Process uploaded documents.

**Pipeline:**
```text
Receive Redis event
↓
Load PDF
↓
Extract text
↓
Chunk text
↓
Generate embeddings
↓
Store Chroma
↓
Update Mongo status
```

**Deliverable:** Uploaded PDFs become searchable.

---

## Phase 9 — LangGraph

**Goal:** Build chatbot workflow.

**Workflow:**
```text
Receive Question
↓
Retrieve Context
↓
Generate Answer
↓
Generate Suggested Questions
↓
Return Response
```

**Nodes:**
- `retrieve_context`
- `generate_answer`
- `generate_suggestions`

**Deliverable:** Graph executes successfully.

---

## Phase 10 — Chat Backend

**Goal:** Question API.

**API:**
- `POST /chat` - `POST /api/chat`

**Flow:**
```text
Receive question
↓
Generate requestId
↓
Publish Redis event
↓
Wait for response
↓
Return response
```

> Do NOT call Python directly.

**Deliverable:** Backend communicates only via Redis.

---

## Phase 11 — Frontend

**Goal:** Build UI.

**Admin:**
- Login
- Dashboard
- Documents

**Public:**
- Chat interface
- Markdown rendering
- Typing indicator
- Suggested questions

**Deliverable:** Complete UI.

---

## Phase 12 — Integration

**Goal:** Connect everything.

**Chat flow:**
```text
Frontend
↓
Backend
↓
Redis
↓
Python
↓
Redis
↓
Backend
↓
Frontend
```

**Upload flow:**
```text
Frontend
↓
Backend
↓
Redis
↓
Python
↓
Chroma
↓
Mongo
```

**Deliverable:** Complete application works.

---

## Phase 13 — Testing

**Verify:**
- Upload PDF
- Delete PDF
- Reprocess PDF
- Ask Question
- Conversation Memory
- Suggested Questions
- Source Document
- Redis communication

---

## Phase 14 — Documentation

- README
- Architecture diagram
- API documentation
- Database schema
- Environment variables
- Setup instructions

---

## Coding Style
- TypeScript strict mode
- Async/await only
- Proper error handling
- Feature-based folders
- Clean imports
- Reusable services
- Small functions
- No duplicated code

---

## Important
- Never jump to another phase.
- Complete one phase.
- Verify.
- Then continue.
- Whenever a phase finishes, stop and wait before generating the next phase.
