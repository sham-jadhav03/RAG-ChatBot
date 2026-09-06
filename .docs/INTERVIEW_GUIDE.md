# Technical Interview & Architecture Guide: Enterprise RAG Chatbot

This comprehensive guide is designed for technical interviews, system design discussions, and architectural deep-dives. It documents the exact implemented architecture, internal lifecycles, distributed patterns, real bugs solved, and technical trade-offs of this Enterprise Knowledge-Base RAG System.

---

## 1. Project Overview

- **Project Name**: Enterprise Knowledge-Base RAG System
- **Problem Statement**: Enterprise employees struggle to quickly extract accurate, verifiable answers from extensive internal PDF documentation (e.g., HR policies, technical manuals, compliance guidelines). Traditional keyword search fails on semantic nuance, while standard public LLMs suffer from hallucinations and lack access to private, proprietary enterprise knowledge.
- **What the System Does**: An end-to-end, multi-tenant knowledge-base assistant where administrators securely upload PDF documents, which are automatically parsed, chunked, and vectorized into dense embeddings. Authenticated employees can query any ingested document through a conversational chat interface and receive grounded answers with exact source citations (page numbers, excerpts, similarity confidence scores) and follow-up suggested questions.
- **Main Users & Use Cases**:
  - **Admin (HR / Operations)**: Uploads PDF documents, monitors ingestion processing statuses, triggers reprocessing, and deletes outdated documentation.
  - **User (Employee)**: Selects active enterprise documents, conducts multi-turn Q&A sessions, inspects citations, and reviews past conversation sessions.
- **Core Technologies Actually Used**:
  - **Frontend**: Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, `@tanstack/react-query`, Lucide React.
  - **Backend API Gateway**: Node.js, Express, TypeScript, `ioredis`, Multer, Mongoose, JWT, bcryptjs.
  - **External Cloud Storage**: ImageKit CDN (binary PDF storage).
  - **Message Broker & Queue**: Redis (Hybrid: Redis Streams for durable chat queries, Redis Pub/Sub for document ingestion and chat responses).
  - **AI / Compute Microservice**: Python 3.11, FastAPI, LangChain, LangGraph, `redis.asyncio`, PyPDFLoader.
  - **Vector Database**: ChromaDB (`PersistentClient` with cosine similarity HNSW indexing).
  - **Embeddings & LLM**: Google Gemini `text-embedding-004` (768 dimensions), ChatNVIDIA / Gemini LLM.
  - **Primary Database**: MongoDB Atlas (Users, Document metadata, Chat history, Session bindings).

---

## 2. 30-Second Project Explanation

> "I built an Enterprise Knowledge-Base RAG system that allows employees to upload and query internal PDF documents with zero hallucinations and exact page citations.
> 
> Architecturally, it’s a decoupled, polyglot microservice system: a **Node.js Express API gateway** handles authentication, multi-layer RBAC, and business logic, while an asynchronous **Python AI service** powers a 2-node **LangGraph RAG pipeline** using ChromaDB and Google Gemini embeddings. 
> 
> The two services communicate over **Redis Streams and Pub/Sub** using consumer groups, explicit ACKs, and in-memory request correlation to ensure queries are never lost even if the AI worker restarts."

---

## 3. 2-Minute Project Explanation

> "The project addresses a critical enterprise challenge: enabling employees to search private corporate documents with high accuracy, auditability, and speed.
> 
> Here is how the end-to-end stack works:
> 
> 1. **Client & API Gateway**: The frontend is built in **Next.js 14** with TailwindCSS and React Query. It communicates with a **Node.js Express TypeScript** backend. Node.js manages JWT authentication, user roles (Admin vs. Employee), and file buffering using Multer.
> 2. **Storage & Metadata**: When an Admin uploads a PDF, Node.js streams it to **ImageKit CDN** for secure file hosting, stores document metadata in **MongoDB** in a `PENDING` state, and publishes a processing event.
> 3. **Asynchronous Messaging**: Instead of coupling the API to heavy AI compute, Node.js dispatches tasks to **Redis**. We use **Redis Pub/Sub** for document lifecycle events and **Redis Streams** with consumer groups (`chat-workers`) for chat queries to provide durability and fault tolerance.
> 4. **AI Microservice & RAG Pipeline**: A **Python FastAPI service** consumes from Redis. For ingestion, it extracts PDF text using `PyPDFLoader`, splits it with `RecursiveCharacterTextSplitter` (1,000-char chunks, 200 overlap), generates 768-dimensional embeddings via Google Gemini, and upserts them into a dedicated **ChromaDB** collection per document.
> 5. **Conversational RAG Execution**: When an employee asks a question, Node.js pulls server-side conversation history from MongoDB, pushes the job to the Redis Stream, and waits on an in-memory Promise. The Python worker executes a compiled **LangGraph** workflow:
>    - **Retrieve Node**: Generates the question embedding, performs cosine similarity search in ChromaDB, and formats context with page citations.
>    - **Generate Node**: Calls the LLM in a single shot to return both the grounded answer and 3 follow-up suggested questions as structured JSON.
> 6. **Response Correlation**: Python publishes the answer over Redis Pub/Sub, Node.js correlates the response using an in-memory Map of Promises (`pendingRequests`), verifies the document was not concurrently deleted, persists the Q&A in MongoDB, and returns HTTP 200 to the client."

---

## 4. Complete Architecture Explanation

### Whiteboard Architecture Flow
```text
[ Browser / Next.js 14 ]
        │  HTTPS REST + JWT
        ▼
[ Node.js Express Gateway ] ──── Multi-Layer RBAC & Input Validation
        │
        ├── Uploads Buffer ──► [ ImageKit CDN ] (Stores PDF binary)
        ├── Reads / Writes ──► [ MongoDB Atlas ] (Users, Documents, Chat History)
        │
        ├── Dispatches Ingestion ──► [ Redis Pub/Sub: pdf_process_requests ]
        │                                        │
        ├── Dispatches Query ─────► [ Redis Stream: pdf_chat_requests ]
        │   (Registers Promise                   │
        │    via requestId)                      ▼
        │                       [ Python AI Microservice (RedisWorker) ]
        │                                        │
        │                         ┌──────────────┴──────────────┐
        │                         ▼                             ▼
        │                [ Ingestion Engine ]          [ LangGraph RAG ]
        │                - PyPDFLoader                 - Retrieve Node
        │                - Text Splitter               - Generate Node (LLM)
        │                - Gemini Embedder                      │
        │                         │                             │
        │                         └──────────────┬──────────────┘
        │                                        ▼
        │                              [ ChromaDB Vector Store ]
        │                              (Per-Document Collections)
        │                                        │
        │◄── Emits Response ─────────────────────┘
        │    (pdf_process_responses / pdf_chat_responses)
        │
    [ Node.js Resolves Promise & Persists ]
        │
        ▼
[ Client Receives Grounded Answer + Citations ]
```

---

## 5. Feature-by-Feature Implementation

### 1. Authentication & Multi-Layer RBAC
- **Implementation**: Stateless JWT with bcrypt password hashing (salt rounds: 10).
- **Roles**: Exactly two roles: `Admin` (HR / Knowledge-Base Manager) and `User` (Employee / Knowledge-Base Consumer).
- **Public Registration**: Strictly forces `role: "user"`. Client requests attempting to inject `role: "admin"` are rejected at the validator layer with `400 Validation Error` and hardcoded to `"user"` in the service. Initial admins are provisioned out-of-band via CLI seeding.
- **Route Guards**:
  - `authenticate`: Validates `Authorization: Bearer <token>` header, attaches `req.user`. Returns `401 Unauthorized` if missing/expired.
  - `requireAdmin`: Checks `req.user.role === "admin"`. Returns `403 Forbidden` if a regular employee attempts mutation.

### 2. Document Upload & Ingestion
- **Implementation**: Multipart upload handled by `multer.memoryStorage()` with a 15 MB limit and PDF MIME validation.
- **Storage**: Uploaded directly to ImageKit CDN (`/rag_knowledge_base`) as base64-encoded buffer.
- **State Transition**: Saved in MongoDB as `PENDING`, initialized with `processingVersion: 1` and a unique `operationId`.
- **Event Dispatch**: Dispatched over Redis Pub/Sub channel `pdf_process_requests`. If no Python worker is active (`subscribers === 0`), Node.js immediately marks the document `FAILED`.

### 3. PDF Parsing & Text Chunking
- **Implementation**: Python worker downloads the PDF via `httpx` and verifies the `%PDF` magic bytes.
- **Loader**: LangChain's `PyPDFLoader` executed inside `asyncio.to_thread` to prevent blocking the async event loop.
- **Splitter**: `RecursiveCharacterTextSplitter` configured with `chunk_size=1000`, `chunk_overlap=200`, splitting on `["\n\n", "\n", " ", ""]`. Preserves page numbers and original filenames in chunk metadata.

### 4. Vector Embedding Generation
- **Implementation**: Google Gemini `text-embedding-004` (via `GoogleGenerativeAIEmbeddings`) generating 768-dimensional float vectors.
- **Optimization**: Formats chunk content as `title: <filename> | text: <page_content>` for enhanced semantic retrieval accuracy.

### 5. ChromaDB Vector Storage
- **Implementation**: `chromadb.PersistentClient` pointing to local disk `./chroma_data`.
- **Isolation**: Uses a **collection-per-document** strategy where `collection_name = document_id`.
- **Index**: Configured with `{"hnsw:space": "cosine"}` for cosine similarity search. Chunks are upserted with deterministic IDs (`<documentId>_<chunkIndex>`).

### 6. Conversational Chat & Session Binding
- **Implementation**: `POST /api/chat/ask` accepting `{ sessionId, documentId, question }`.
- **Integrity Enforcement**: 
  - Validates document exists and has status `COMPLETED`.
  - Enforces **Session-Document Binding**: Rejects the query with `409 Conflict` if the client attempts to use an existing `sessionId` with a different `documentId`.

### 7. Server-Side Conversation History
- **Implementation**: Node.js queries MongoDB for the last 5 Q&A pairs for that specific session and document.
- **Security**: Client-supplied history is completely ignored, preventing prompt injection and token inflation attacks.

### 8. Citations & Suggested Follow-up Questions
- **Implementation**: Retrieved ChromaDB metadata is transformed into normalized source objects: `{ documentName, pageNumber, excerpt, similarity }`.
- **Single-Shot Efficiency**: The LangGraph `generate_node` instructs the LLM via JSON schema mode to return both the answer and an array of 3 suggested follow-up questions in one inference call, saving 50% on LLM latency and token costs.

### 9. Document Reprocessing & Deletion
- **Reprocess (`GET /:id/reprocess`)**: Increments `processingVersion`, updates status to `PENDING`, assigns a new `operationId`, and triggers ingestion. Python overwrites existing vectors in ChromaDB via `collection.upsert()`.
- **Delete (`DELETE /:id`)**: Deletes the MongoDB record and publishes action `DELETE`. Python drops the Chroma collection via `vector_store.delete_collection(document_id)` in $O(1)$ time.

---

## 6. The RAG Pipeline (Step-by-Step)

```text
[1. User Question] ──► POST /api/chat/ask { sessionId, documentId, question }
                              │
[2. Query Pre-flight] ────────┼── Validate JWT & RBAC
                              ├── Check document.processingStatus == "COMPLETED"
                              ├── Verify session-document binding
                              └── Fetch last 5 Q&A pairs from MongoDB
                              │
[3. Redis Dispatch] ──────────┼── Generate requestId (UUIDv4)
                              ├── Register in pendingRequests Map (30s timer)
                              └── XADD to stream "pdf_chat_requests"
                              │
[4. Python Consumption] ──────┼── XREADGROUP (group: "chat-workers", consumer: "worker-...")
                              └── Enter LangGraph: invoke_rag_graph()
                              │
[5. Retrieve Node] ───────────┼── Generate 768-dim query embedding via Gemini text-embedding-004
                              ├── Query ChromaDB collection(documentId) with top_k=5
                              ├── Extract text chunks, page numbers, and similarity scores
                              └── Construct formatted context string
                              │
[6. Generate Node] ───────────┼── Construct prompt: System Rules + History + Context + Question
                              ├── Invoke LLM (ChatNVIDIA/Gemini) in JSON mode
                              └── Output: { "answer": "...", "suggested_questions": [...] }
                              │
[7. Publish & ACK] ───────────┼── PUBLISH to Pub/Sub "pdf_chat_responses"
                              └── XACK message_id on stream "pdf_chat_requests"
                              │
[8. Gateway Resolution] ──────┼── Subscriber receives response -> Matches requestId
                              ├── Resolve Promise in pendingRequests Map
                              ├── Re-verify document existence in MongoDB (Race prevention)
                              ├── Persist Q&A + citations to MongoDB (chatMessageModel)
                              └── Return HTTP 200 to Frontend
```

---

## 7. Redis Deep-Dive

### Why Redis Exists in this Architecture
1. **Decoupling**: Separates the Node.js event loop from long-running, blocking Python AI tasks.
2. **Durability**: Redis Streams prevents dropped queries during AI worker spikes or restarts.
3. **Consumer Load Balancing**: Redis Streams consumer groups distribute queries evenly across multiple Python worker processes.

### Redis Streams vs. Pub/Sub Protocol Mismatch (Real Engineering Problem)
- **The Issue**: Early in development, Node.js dispatched chat requests using `XADD` to `pdf_chat_requests`, but the Python worker attempted to listen using `pubsub.subscribe("pdf_chat_requests")`.
- **Root Cause**: Redis Pub/Sub and Redis Streams are completely separate subsystems. Pub/Sub is a real-time, memory-less socket broadcast. Streams is an append-only log on a key. A `SUBSCRIBE` call will **never** receive messages added via `XADD`.
- **The Fix**: Rewrote the Python worker to use a persistent consumer loop with `xreadgroup()` on stream `pdf_chat_requests`, reserving Pub/Sub strictly for response delivery and document status broadcasts.

### Consumer Groups, XACK, and XAUTOCLAIM
- **Consumer Group**: `chat-workers`. Initialized on startup with `xgroup_create(..., id="0", mkstream=True)`.
- **Worker Naming**: Dynamic per-task naming: `worker-<task_name>`.
- **Explicit Acknowledgment (`XACK`)**: Called **only after** response publication. If processing fails, the message remains unacknowledged in the Pending Entries List (PEL).
- **Stale Message Recovery (`XAUTOCLAIM`)**: Before reading new messages (`>`), the worker calls `xautoclaim` with `min_idle_time=60_000` (60 seconds). Any message abandoned by a crashed worker is automatically claimed and re-processed.

---

## 8. `requestId` vs. `operationId`

| Dimension | `requestId` | `operationId` |
| :--- | :--- | :--- |
| **Domain** | Chat & RAG Query Pipeline | Document Ingestion Lifecycle |
| **Origin** | Generated in Node.js `chatService` (`uuidv4()`). | Generated in Node.js `documentService` (`uuidv4()`). |
| **Storage** | In-memory in Node.js `pendingRequests` Map (30s TTL). Persisted in MongoDB on success. | Persisted in MongoDB `Document.currentOperationId` along with `processingVersion`. |
| **Transport** | Sent in `pdf_chat_requests` stream $\rightarrow$ returned in `pdf_chat_responses`. | Sent in `pdf_process_requests` Pub/Sub $\rightarrow$ returned in `pdf_process_responses`. |
| **Problem Solved** | Bridges an asynchronous Redis messaging pipeline back to a waiting synchronous client HTTP connection. | Solves race conditions, out-of-order execution, and stale responses in background document processing. |

### Interview Answer: *"Why didn't you just use `requestId` everywhere?"*
> "`requestId` is an **ephemeral in-memory correlation key** designed for synchronous HTTP request-response matching. It exists in memory for at most 30 seconds and dies once the HTTP response is sent.
> 
> PDF processing, however, is a **long-running stateful lifecycle** that can take minutes. If an Admin uploads a large PDF and immediately clicks 'Reprocess', two asynchronous background jobs are now running in Python. If the first job finishes second, a naive system would overwrite the document status with stale data. 
> 
> We introduced `operationId` paired with `processingVersion` as an **optimistic concurrency control token** in MongoDB. When Python publishes a completion event, Node.js checks `document.currentOperationId === operationId`. If it doesn't match, Node.js discards the response, guaranteeing that slow or zombie workers can never corrupt document state."

---

## 9. Important Engineering Problems Solved

### Problem 1: Redis Streams vs. Pub/Sub Protocol Mismatch
- **Problem**: Python worker never received chat requests sent by Node.js.
- **Root Cause**: Node.js used `XADD` (Redis Stream), while Python used `pubsub.subscribe()`. These operate on separate Redis engines.
- **Fix**: Implemented `xreadgroup()` with consumer group `chat-workers` in Python.
- **Result**: Reliable, persistent stream delivery with consumer load balancing.

### Problem 2: Python `conversationHistory` JSON Parsing Crash
- **Problem**: Chat worker threw `JSONDecodeError` on certain queries containing conversation history.
- **Root Cause**: Node.js stringified conversation history as a JSON string when pushing fields to Redis Stream (`XADD` stores key-value string pairs). In Python, if history was already parsed or passed as an object, calling `json.loads()` directly crashed.
- **Fix**: Added safe type checking: `conversation_history = json.loads(raw_history) if isinstance(raw_history, str) else raw_history`.
- **Result**: Zero crashes on history ingestion.

### Problem 3: Stale Document Processing Responses Overwriting State
- **Problem**: Clicking "Reprocess" while a document was being processed resulted in inconsistent MongoDB status.
- **Root Cause**: Out-of-order response arrivals from parallel background worker tasks.
- **Fix**: Added `operationId` (UUID) and `processingVersion` (counter) on the MongoDB Document model. Node.js rejects any response where `operationId !== document.currentOperationId`.
- **Result**: Strict state consistency across concurrent operations.

### Problem 4: Concurrent Document Deletion During RAG Execution (REL-03)
- **Problem**: If an admin deleted a document while a user was waiting for an LLM answer, Node.js persisted a chat message referencing a non-existent document.
- **Root Cause**: Chat flow assumed document existence validated at step 1 remained true at step 10.
- **Fix**: Added pre-save check: `await documentModel.findById(documentId).select("_id").lean()`. If deleted, persistence is aborted and HTTP `410 Gone` is returned.
- **Result**: Database referential integrity preserved under race conditions.

### Problem 5: React `useSyncExternalStore` Infinite Re-Render Loop
- **Problem**: Frontend crashed with `Maximum update depth exceeded` on `/auth/login`.
- **Root Cause**: `getAuthUser` inside `useAuth.ts` parsed `localStorage` on every call and returned a new object reference, causing React's `useSyncExternalStore` to trigger an infinite update loop.
- **Fix**: Implemented referential snapshot caching (`cachedUserRaw` / `cachedUser`) in `frontend/lib/auth.ts`.
- **Result**: Clean, stable authentication state synchronization across browser tabs.

---

## 10. Technology "Why?" Questions

- **Why Next.js 14 & React?**: Next.js App Router provides clean route protection, server-side layouts, and seamless client-side interactivity for real-time chat.
- **Why Node.js for Backend Gateway?**: Lightweight, asynchronous I/O multiplexing ideal for handling thousands of concurrent user connections, validating JWTs, and dispatching events to Redis without thread-pool overhead.
- **Why Python for the AI Service?**: Python is the lingua franca of AI/ML. Native support for LangChain, LangGraph, ChromaDB, PyPDFLoader, and embedding libraries makes it the only practical choice for complex RAG pipelines.
- **Why Redis Streams instead of RabbitMQ / Kafka?**: Redis was already in the stack for caching and Pub/Sub. Redis Streams provides message persistence, consumer groups, and pending entry tracking with microsecond latency without the operational overhead of running a separate Kafka or RabbitMQ cluster.
- **Why ChromaDB?**: Embedded, fast, developer-friendly vector store supporting per-document collection isolation, cosine similarity metrics, and local persistence without needing a dedicated external vector SaaS subscription.
- **Why LangGraph instead of simple LangChain chains?**: LangGraph models RAG as a stateful computational graph (`StateGraph(ChatState)`). It cleanly separates retrieval from generation into discrete nodes, making it easy to add conditional retries, query transformations, or guardrails in the future.
- **Why MongoDB?**: Flexible JSON document model ideal for storing nested source citations, varied document metadata, and polymorphic conversation histories with dynamic pagination.

---

## 11. Backend Interview Questions

### Q: Explain your Express architecture and the Controller-Service split.
> **Answer**: We follow a strict **layered architecture**:
> - **Routes**: Define URL paths, attach rate limiters, and wire middleware (`authenticate`, `requireAdmin`, validators).
> - **Validators**: Sanitize and validate request payloads before hitting business logic (e.g., `AuthValidator`, `DocumentValidator`, `ChatValidator`).
> - **Controllers**: Thin request handlers responsible solely for extracting request parameters, calling services, and formatting HTTP response envelopes (`{ success, message, data }`).
> - **Services**: Thick business logic containing MongoDB database calls, Redis event publishing, ImageKit interactions, and correlation management.

### Q: How is authentication and password security handled?
> **Answer**: Passwords are never stored in plain text. A Mongoose `pre('save')` hook automatically salts and hashes passwords using `bcryptjs` with 10 salt rounds. Passwords are set with `select: false` on the Mongoose schema to prevent accidental leakage in queries. Login validates credentials using an instance method `comparePassword()` and issues a signed JWT containing the user's ID and role, signed with `JWT_SECRET`.

---

## 12. RAG & GenAI Interview Questions

### Q: What is RAG, and why use it instead of sending the entire document to the LLM?
> **Answer**: RAG (Retrieval-Augmented Generation) combines external knowledge retrieval with LLM generation. Passing entire 100-page enterprise PDFs directly into an LLM context window causes:
> 1. **High Latency & Costs**: Processing hundreds of thousands of tokens on every message is prohibitively slow and expensive.
> 2. **Lost in the Middle**: LLMs suffer degradation in recall when answers are buried in massive context windows.
> 3. **Hallucinations**: Without strict context anchoring, LLMs generate convincing but false corporate policies. RAG retrieves only the top 4–5 most relevant 1,000-character chunks, keeping answers grounded, cheap, and fast.

### Q: How did you select your chunk size and overlap?
> **Answer**: We use `chunk_size=1000` characters with `chunk_overlap=200` characters. 1,000 characters corresponds to approximately 200–250 words—a coherent semantic paragraph. The 200-character overlap prevents information fragmentation where key sentences or definitions are severed across chunk boundaries.

### Q: How do you enforce citations and prevent hallucinations?
> **Answer**: 
> 1. **Prompt Constraints**: The system prompt strictly commands: *"Answer questions ONLY based on the provided context. If the context doesn't contain the answer, say 'I don't have information about that'. Cite sources when possible."*
> 2. **Metadata Tracking**: Every vector chunk in ChromaDB stores `page_number` and `source_filename`.
> 3. **Structured Normalization**: The Python service extracts the similarity score, page number, and excerpt, which Node.js persists in MongoDB and displays in the UI as clickable evidence cards.

---

## 13. Frontend Architecture

- **State Management**: Uses `@tanstack/react-query` for server-state caching, automatic refetching, and pagination of document lists and chat history. Local UI state is managed via React `useState` and custom hooks (`useAuth`, `useChat`, `useChatHistory`, `useDocuments`).
- **Session Isolation**: Sessions are managed via `lib/session.ts`. Each document chat session generates a unique UUID `sessionId` stored in `sessionStorage`.
- **Streaming / SSE Status**: **Not implemented**. The system currently uses atomic JSON request-response over REST (`chatapi.ask`). This was an intentional design decision to allow single-shot JSON generation of the answer, source citations, and suggested questions together.

---

## 14. Database & Persistence Architecture

### MongoDB Models
1. **`User`**: `username`, `email`, `password` (hashed, `select: false`), `role` (`"admin"` | `"user"`), `refreshTokenHash`.
2. **`Document`**: `fileName`, `filePath` (ImageKit URL), `fileSize`, `uploadDate`, `processingStatus` (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`), `errorMessage`, `uploadedBy` (ref: User), `currentOperationId`, `processingVersion`.
   - Indexes: `{ processingStatus: 1 }`, `{ createdAt: -1 }`.
3. **`ChatMessage`**: `sessionId`, `documentId` (ref: Document), `userId` (ref: User), `question`, `answer`, `sources` (nested schema: `documentName`, `pageNumber`, `excerpt`, `similarity`), `suggestedQuestions`, `requestId`.
   - Compound Indexes: `{ sessionId: 1, createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`.

### Why Vector Data is Stored Separately in ChromaDB
> "MongoDB is optimized for transactional ACID operations, relational referencing, and B-tree indexing on structured fields. It cannot natively perform high-dimensional approximate nearest neighbor (ANN) vector searches with HNSW graphs as efficiently as dedicated vector databases. Storing vectors in ChromaDB provides sub-10ms semantic similarity queries and enables instant $O(1)$ collection dropping when a document is deleted."

---

## 15. Security Architecture

### Implemented Security Measures:
- **Stateless JWT**: Verified on every protected route via `authenticate` middleware.
- **Password Protection**: Salted bcrypt hashes (10 rounds); omitted from query projections by default.
- **Multi-Layer RBAC**: Document mutation (`POST /upload`, `DELETE /:id`, `GET /:id/reprocess`) restricted to `admin` on the backend API.
- **Input Sanitization**: Rejection of unexpected `role` properties during registration; strict regex validation on emails; pagination caps (`limit <= 50`).
- **File Upload Protection**: In-memory buffer validation; PDF MIME type enforcement; 15 MB file size limit; PDF header magic-byte verification (`%PDF`).
- **Session Integrity**: Session-document binding validation in MongoDB prevents session hijacking across documents.

### Explicitly NOT Implemented:
- **Redis Token Blacklist**: Not implemented. Tokens remain valid until their natural expiration.
- **Refresh Token Rotation**: `refreshTokenHash` exists in the schema, but active rotation endpoints are not implemented.

---

## 16. Failure Scenarios & Edge Cases

| Failure Scenario | Current Implemented Behavior |
| :--- | :--- |
| **Redis Server Down** | Node.js `ioredis` retries with exponential backoff (100–2000ms). Chat requests fail with 503 Service Unavailable. Python worker catches errors and attempts reconnects every 1–60s. |
| **Python Worker Crashes Mid-LLM Call** | The stream entry is not acknowledged (`XACK` was never called). Node.js times out after 30s (`504 Gateway Timeout`). After 60s, another worker claims the message via `XAUTOCLAIM`. |
| **Worker Crashes After Publish But Before XACK** | Client receives HTTP 200. After 60s, `XAUTOCLAIM` claims the message and re-executes it. When the duplicate response arrives, Node.js finds no entry in `pendingRequests` and safely drops it. |
| **Document Uploaded When Python is Down** | Node.js detects `subscribers === 0` on `pdf_process_requests` publish. It immediately marks MongoDB document status as `FAILED` with `"No Redis subscribers available"`. |
| **Document Deleted During In-Flight Chat Query** | Node.js re-queries MongoDB before saving the chat message (`REL-03`). If deleted, persistence is aborted and HTTP `410 Gone` is returned. |

---

## 17. Trade-offs & Design Decisions

1. **Redis Streams for Chat vs. Pub/Sub for Ingestion**:
   - *Decision*: Streams for chat; Pub/Sub for ingestion.
   - *Alternative*: Streams for everything or Pub/Sub for everything.
   - *Trade-off*: Chat requires strict at-least-once delivery, consumer balancing, and crash recovery. Document ingestion is tracked via persistent MongoDB status columns where transient pub/sub notifications are sufficient.
2. **Collection-per-Document in ChromaDB**:
   - *Decision*: Isolated collection per document (`name = documentId`).
   - *Alternative*: Single global collection with metadata filtering (`{ "documentId": id }`).
   - *Trade-off*: Single collection requires complex metadata filtering during HNSW search and expensive row-by-row deletion. Collection-per-document provides instant $O(1)$ collection dropping and guaranteed zero cross-document context leakage.
3. **Atomic JSON Response vs. Streaming (SSE)**:
   - *Decision*: Single complete JSON response.
   - *Alternative*: Token streaming via Server-Sent Events.
   - *Trade-off*: Streaming provides faster time-to-first-token, but makes returning structured source citations and generated follow-up questions in a single LLM call significantly more complex to parse reliably.

---

## 18. Known Limitations

1. **Local ChromaDB Storage**: ChromaDB runs as an embedded persistent database on local disk (`./chroma_data`). Horizontal scaling of Python workers across multiple physical machines requires migrating to a client-server vector database.
2. **In-Memory Promise Map Scaling**: `pendingRequests` lives in the local Node.js process memory. In a multi-instance Node.js cluster, the instance receiving the Redis response might not be the instance holding the client connection.
3. **No Automatic Ingestion Retry**: If document ingestion fails due to worker downtime, it marks the document `FAILED` and requires manual admin intervention via "Reprocess".

---

## 19. Rapid-Fire Technical Q&A

1. **What is the difference between Redis Pub/Sub and Redis Streams?** Pub/Sub is fire-and-forget memoryless broadcasting; Streams is a persistent append-only log with consumer groups and acknowledgments.
2. **What does `XREADGROUP` with ID `>` mean?** It instructs Redis to return only new messages that have never been delivered to any consumer in the group.
3. **What is the purpose of `XACK`?** Removes a processed message from the Pending Entries List (PEL).
4. **What does `XAUTOCLAIM` do?** Reassigns ownership of pending messages that have been idle past a threshold (60s) from dead workers to an active worker.
5. **How does Node.js know which HTTP request a Redis response belongs to?** Using `requestId` correlated in an in-memory Map of Promises.
6. **Why do we need `operationId` in MongoDB?** To reject out-of-order stale background responses during document reprocessing or deletion.
7. **What embedding model is used?** Google Gemini `text-embedding-004` (768 dimensions).
8. **What vector distance metric is configured in Chroma?** Cosine similarity (`{"hnsw:space": "cosine"}`).
9. **What is the chunk size and overlap?** Chunk size: 1,000 characters; Overlap: 200 characters.
10. **Can an employee promote themselves to Admin?** No. Public registration hardcodes `role: "user"`, client-supplied roles are rejected, and initial admins are seeded.
11. **What HTTP status code is returned when a chat query times out?** `504 Gateway Timeout` (after 30 seconds).
12. **What happens if a document is deleted while a chat query is in-flight?** Node.js detects missing document before persistence and returns `410 Gone`.
13. **Why use LangGraph over standard LangChain?** LangGraph provides stateful, graph-based control flow with explicit state schemas (`ChatState`), making multi-step RAG modular.
14. **How many Q&A pairs are included in conversation history?** Exactly 5 pairs, fetched strictly from MongoDB.
15. **Does the client ever supply conversation history?** No, client-supplied history is discarded to prevent prompt injection.
16. **How does the LLM generate suggested questions?** In the same single LLM call as the answer, using structured JSON output mode.
17. **Where are the uploaded PDF files stored?** In ImageKit CDN cloud storage; only the URL and file size are stored in MongoDB.
18. **What prevents PDF files larger than 15 MB from uploading?** Multer limits configured at the route middleware layer.
19. **What happens if a user selects a different document in an existing session?** Node.js detects document mismatch and returns `409 Conflict`.
20. **Is token streaming implemented?** No, the system returns atomic JSON responses.
21. **Is Redis token blacklisting implemented?** No, JWTs expire based on their signed `exp` timestamp.
22. **What happens if Redis publishes with 0 subscribers on document upload?** Node.js immediately marks the document `FAILED`.
23. **How does Python prevent blocking the async event loop during PDF parsing?** Uses `asyncio.to_thread(loader.load)` for synchronous PyPDFLoader calls.
24. **How does Python handle graceful shutdown?** Tracks in-flight tasks in `_active_tasks` and waits up to 25 seconds before terminating connections.
25. **What is the role of `bcryptjs`?** Salt and hash passwords with 10 rounds before saving to MongoDB.
26. **What indexes exist on the ChatMessage collection?** Compound indexes on `{ sessionId: 1, createdAt: -1 }` and `{ userId: 1, createdAt: -1 }`.
27. **Why use cosine similarity for text embeddings?** Cosine similarity measures angular divergence rather than vector magnitude, making it invariant to text length.
28. **How does the frontend avoid infinite re-render loops in `useAuth`?** Referential snapshot caching in `getAuthUser` for `useSyncExternalStore`.
29. **What happens if the LLM provider fails?** The Python worker catches the exception, publishes an error payload with `requestId`, and Node.js returns `502 Bad Gateway`.
30. **What role does Multer play?** Parses multipart/form-data and stores binary files in memory buffers for CDN upload.

---

## 20. "Tell Me About a Difficult Bug" (3 Real Stories)

### Story 1: The Redis Streams vs. Pub/Sub Protocol Mismatch
- **Situation**: During early integration between the Node.js API gateway and the Python AI service, chat requests were never reaching the RAG pipeline.
- **Problem**: Node.js was successfully executing `XADD` to `pdf_chat_requests`, but the Python worker’s listener never triggered, causing all client requests to time out after 30 seconds.
- **Investigation**: I checked Redis CLI using `MONITOR` and `PUBSUB CHANNELS`. I saw the stream key being updated with `XADD`, but no Pub/Sub messages were passing. I inspected the Python codebase and found it was initializing `pubsub = client.pubsub()` and calling `await pubsub.subscribe("pdf_chat_requests")`.
- **Root Cause**: Redis Pub/Sub and Redis Streams are distinct subsystems. Pub/Sub is a transient, real-time message bus, whereas Streams is an append-only persistent log on a database key. A Pub/Sub subscriber cannot read messages written with `XADD`.
- **Fix**: I refactored the Python Redis worker to use Redis Streams consumer groups. I added group initialization via `xgroup_create`, implemented an asynchronous reading loop using `xreadgroup()` with consumer group `chat-workers`, and added explicit `XACK` calls after successful RAG generation.
- **Result**: Chat requests flowed reliably, with consumer load-balancing and zero message loss.
- **What I Learned**: Never assume tools under the same brand (Redis) share transport protocols. Always design distributed communication around the specific data structures being used.

### Story 2: The Stale Ingestion Response Race Condition
- **Situation**: In testing document management, clicking "Reprocess" on a document that was already processing caused the status in the UI to glitch between `COMPLETED` and `PENDING`.
- **Problem**: Ingestion tasks could complete out-of-order, causing a slow initial processing job to overwrite the status of a newly initiated reprocess job.
- **Investigation**: I traced worker logs and noticed that when a user reprocessed a document, a new background task was spawned, but the old task was still crunching embeddings. When the old task finished, it published `status: "COMPLETED"`, which Node.js blindly accepted and saved to MongoDB, even though the new job was still running.
- **Root Cause**: The response payload only contained `documentId`. The backend lacked an optimistic concurrency control mechanism to associate responses with specific task executions.
- **Fix**: I introduced an `operationId` (UUIDv4) and `processingVersion` counter on the MongoDB `Document` model. When an upload or reprocess begins, Node.js assigns a fresh `operationId` and increments the version. When Python finishes, it echoes the `operationId`. Node.js verifies `document.currentOperationId === operationId` before applying updates, discarding stale responses.
- **Result**: Complete state consistency during rapid reprocess and delete operations.
- **What I Learned**: In asynchronous distributed systems, entity IDs alone are insufficient for state synchronization; you must correlate specific operations.

### Story 3: The React 18 `useSyncExternalStore` Infinite Render Loop
- **Situation**: Users attempting to log in or register experienced browser tab freezing and a crash with `Maximum update depth exceeded`.
- **Problem**: React was re-rendering indefinitely as soon as the authentication hook mounted.
- **Investigation**: I placed breakpoints in `useAuth.ts` and noticed that `useSyncExternalStore` was firing continuously. The snapshot selector `getAuthUser()` was reading `localStorage.getItem("user")` and returning `JSON.parse(data)`.
- **Root Cause**: In JavaScript, `JSON.parse()` creates a **new object reference in memory** every time it executes. React’s `useSyncExternalStore` uses `Object.is()` to check if the store changed. Because the object reference was always different, React assumed the store changed on every tick, triggering an infinite render loop.
- **Fix**: I implemented referential snapshot caching in `frontend/lib/auth.ts`. I stored `cachedUserRaw` (string) and `cachedUser` (parsed object). `getAuthUser` now compares the raw string from `localStorage`; if unchanged, it returns the existing cached object reference.
- **Result**: Zero infinite loops, instant page loads, and seamless multi-tab authentication state sync.
- **What I Learned**: React 18 external store snapshots must guarantee referential stability, not just value equality.

---

## 21. Final Interview Cheat Sheet

- **Project One-Liner**: An enterprise document RAG chatbot built with Next.js, Node.js, Redis, and a Python LangGraph RAG microservice.
- **Architecture One-Liner**: Polyglot microservices decoupled via Redis Streams (for durable chat) and Redis Pub/Sub (for document ingestion).
- **RAG One-Liner**: 2-node LangGraph pipeline using Google Gemini 768-dim embeddings, ChromaDB per-document collections, and single-shot answer + suggestion generation.
- **Redis One-Liner**: Consumer group stream queuing (`chat-workers`) with `XACK` acknowledgments and `XAUTOCLAIM` stale message recovery.
- **Biggest Technical Challenge**: Bridging asynchronous Redis Stream processing back to synchronous client HTTP requests via in-memory Promise correlation (`pendingRequests`).
- **Strongest Engineering Decision**: Collection-per-document vector isolation in ChromaDB for instant $O(1)$ deletions and zero cross-document data leakage.
- **Biggest Limitation**: In-memory Promise Map in Node.js requires sticky sessions or distributed Pub/Sub partitioning to scale across multiple Node.js gateway instances.
- **Top 5 Questions to Prepare For**:
  1. *Why separate Node.js and Python instead of building everything in one language?*
  2. *How do you prevent duplicate message processing when recovering crashed workers?*
  3. *Why did you need both `requestId` and `operationId`?*
  4. *How does LangGraph structure the RAG retrieval and generation flow?*
  5. *What happens under the hood when a user asks a question while the document is being deleted?*
