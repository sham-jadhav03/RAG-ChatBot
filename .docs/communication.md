# Architectural Communication Guide: Node.js Backend & Python AI Service

> **Last verified:** 2026-08-16\
> **Current status:** ✅ Node.js ↔ Python AI communication established
> and Stage 1 PDF ingestion verified end-to-end.

This document defines the communication protocols, Redis channels,
message contracts, architecture, and verification status for the
**Node.js Express Backend** and **Python FastAPI AI Service**.

------------------------------------------------------------------------

## 1. Communication Architecture

The RAG Chatbot uses a hybrid communication model:

1.  **HTTP/REST (Synchronous)** --- client-facing APIs, health checks,
    and service monitoring.
2.  **Redis Pub/Sub (Asynchronous)** --- Node.js ↔ Python AI
    communication for PDF ingestion and RAG processing.

The Node.js backend owns HTTP routing, authentication, document
metadata, and client-facing APIs. The Python AI service owns PDF
processing, embeddings, vector search, and the AI/RAG workflow.

### Architectural Flow

``` text
                         ┌──────────────────────┐
                         │      Frontend        │
                         │      Next.js         │
                         └──────────┬───────────┘
                                    │ HTTP
                                    ▼
                         ┌──────────────────────┐
                         │   Node.js Backend    │
                         │ Express + TypeScript │
                         └──────────┬───────────┘
                                    │
                         Redis Pub/Sub
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Python AI Service  │
                         │ FastAPI + LangChain  │
                         │      LangGraph      │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              ┌───────────┐                   ┌──────────┐
              │ ChromaDB  │                   │ MongoDB  │
              └───────────┘                   └──────────┘
```

------------------------------------------------------------------------

## 2. Redis Pub/Sub Channels

Both services use the same Redis instance and the following canonical
channel names:

  -------------------------------------------------------------------------------------
  Logical Flow   Channel                   Publisher      Subscriber     Status
  -------------- ------------------------- -------------- -------------- --------------
  PDF ingestion  `pdf_process_requests`    Node.js        Python AI      ✅ Verified
  request                                                                

  PDF ingestion  `pdf_process_responses`   Python AI      Node.js        ✅ Verified
  response                                                               

  RAG chat       `pdf_chat_requests`       Node.js        Python AI      ⏳ Chat E2E
  request                                                                pending

  RAG chat       `pdf_chat_responses`      Python AI      Node.js        ⏳ Chat E2E
  response                                                               pending
  -------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 3. PDF Ingestion Contract

### 3.1 Request --- `pdf_process_requests`

``` json
{
  "type": "process_pdf",
  "action": "PROCESS",
  "documentId": "string",
  "filePath": "https://ik.imagekit.io/...",
  "fileName": "dummy.pdf"
}
```

Supported actions:

-   `PROCESS`
-   `REPROCESS`
-   `DELETE`

For `DELETE`, only `type`, `action`, and `documentId` are required.

### 3.2 Response --- `pdf_process_responses`

``` json
{
  "type": "process_pdf_response",
  "documentId": "string",
  "status": "COMPLETED",
  "chunksCreated": 1,
  "embeddingsGenerated": 1,
  "totalTokens": 3,
  "error": null,
  "timestamp": "ISO-8601 timestamp"
}
```

------------------------------------------------------------------------

## 4. PDF Upload & Processing Flow

``` text
Client
  │
  │ POST /api/documents/upload
  ▼
Node.js Backend
  │
  ├── Upload PDF → ImageKit
  ├── Create MongoDB document
  │      status = PENDING
  │
  └── Publish → pdf_process_requests
                │
                ▼
             Python AI
                │
                ├── status = PROCESSING
                ├── Download ImageKit PDF
                ├── PyPDFLoader
                ├── Text chunking
                ├── Gemini embeddings
                ├── Store vectors in ChromaDB
                ├── status = COMPLETED
                │
                └── Publish → pdf_process_responses
                                  │
                                  ▼
                              Node.js
                                  │
                                  └── Update MongoDB
                                      status = COMPLETED
```

------------------------------------------------------------------------

## 5. Stage 1 --- End-to-End Verification

### Verification date

**2026-08-16**

### Result

## ✅ PASSED

A real PDF upload was successfully processed through the complete
Node.js → Redis → Python → ChromaDB → MongoDB → Redis → Node.js
pipeline.

### Verified evidence

#### Node.js → Redis

``` text
Published PDF request to pdf_process_requests, subscribers: 1
```

This proves the Python worker was subscribed to the same Redis channel
when the request was published.

#### Python received the request

``` text
PDF process request: <documentId> - dummy.pdf
```

#### MongoDB lifecycle

``` text
PENDING
   ↓
PROCESSING
   ↓
COMPLETED
```

#### PDF download

``` text
HTTP/1.1 200 OK
```

The ImageKit remote PDF URL was successfully downloaded.

#### PDF processing

``` text
Loaded 1 pages from PDF
Created 1 chunks
```

#### Gemini embeddings

``` text
Generated 1 embeddings (dimension: 768)
```

#### ChromaDB

``` text
Stored 1 vectors (collection total: 1)
```

#### Python → Redis

``` text
PDF response published for <documentId>
```

#### Redis → Node.js

``` text
Document <documentId> status updated to: COMPLETED
```

### Final Stage 1 result

``` text
PDF Upload
   ↓
ImageKit                         ✅
   ↓
MongoDB PENDING                  ✅
   ↓
Redis Request                    ✅
   ↓
Python Worker                    ✅
   ↓
MongoDB PROCESSING               ✅
   ↓
ImageKit Download                ✅
   ↓
PDF Parsing                      ✅
   ↓
Chunking                         ✅
   ↓
Gemini Embedding (768D)          ✅
   ↓
ChromaDB Vector Storage          ✅
   ↓
MongoDB COMPLETED                ✅
   ↓
Redis Response                   ✅
   ↓
Node.js Subscriber               ✅
```

------------------------------------------------------------------------

## 6. Redis Connection Resilience

During integration testing, the Python Redis Pub/Sub connection
experienced transient connection timeouts.

The worker was updated to recover instead of permanently crashing:

``` text
Redis connection lost
        ↓
Reconnect with backoff
        ↓
Connected to Redis
        ↓
Publisher initialized
        ↓
Channels resubscribed
        ↓
Worker listening
```

This behavior was observed successfully during the Stage 1 test.

------------------------------------------------------------------------

## 7. Status Lifecycle

The document processing status is standardized as:

``` text
PENDING
   ↓
PROCESSING
   ↓
COMPLETED
```

Failure path:

``` text
PENDING / PROCESSING
        ↓
      FAILED
```

The verified successful run ended with:

``` text
COMPLETED
```

------------------------------------------------------------------------

## 8. RAG Chat Communication Contract

The chat communication layer is defined but has **not yet been marked
end-to-end verified**.

### 8.1 Request --- `pdf_chat_requests`

``` json
{
  "type": "ask_question",
  "requestId": "UUID",
  "sessionId": "documentId",
  "question": "string",
  "conversationHistory": [
    {
      "role": "user",
      "content": "string"
    },
    {
      "role": "assistant",
      "content": "string"
    }
  ]
}
```

### 8.2 Response --- `pdf_chat_responses`

``` json
{
  "type": "ask_question_response",
  "requestId": "UUID",
  "answer": "string",
  "sources": [
    {
      "text": "string",
      "similarity": 0.0,
      "page_number": 0,
      "metadata": {}
    }
  ],
  "suggestedQuestions": [
    "string"
  ],
  "error": null,
  "timestamp": "ISO-8601 timestamp"
}
```

### Chat flow

``` text
User
 ↓
Node.js /api/chat/ask
 ↓
Generate requestId
 ↓
Redis: pdf_chat_requests
 ↓
Python AI
 ↓
Query embedding
 ↓
Chroma similarity search
 ↓
LangGraph
 ├── Retrieve
 ├── Generate
 └── Suggest
 ↓
Redis: pdf_chat_responses
 ↓
Node.js
 ↓
HTTP response / frontend
```

------------------------------------------------------------------------

## 9. Remaining Work

The communication layer for **PDF ingestion is established and
verified**.

The following work remains:

### Chat Backend

-   [ ] Implement/verify `POST /api/chat/ask`
-   [ ] Implement request correlation using `requestId`
-   [ ] Implement pending-request timeout handling
-   [ ] Verify Node subscription to `pdf_chat_responses`

### Chat AI Flow

-   [ ] Verify Python receives `pdf_chat_requests`
-   [ ] Verify Chroma retrieval
-   [ ] Verify LangGraph `retrieve → generate → suggest`
-   [ ] Verify Python publishes `pdf_chat_responses`
-   [ ] Verify Node matches `requestId`
-   [ ] Verify complete chat response reaches the client

### Document Operations

-   [ ] Verify PDF reprocess flow
-   [ ] Verify PDF delete → Chroma collection cleanup
-   [ ] Verify failure-path behavior
-   [ ] Remove temporary diagnostic logging such as stray `undefined`
    output

### Final Integration

-   [ ] Frontend ↔ Node.js integration
-   [ ] Chat UI
-   [ ] Conversation memory
-   [ ] Suggested questions
-   [ ] Source document/page display
-   [ ] Streaming response if required
-   [ ] Full integration testing

------------------------------------------------------------------------

## 10. Verification Checklist

### Stage 1 --- PDF Ingestion

-   [x] Node backend starts
-   [x] Python AI service starts
-   [x] Both connect to Redis
-   [x] Node publishes to `pdf_process_requests`
-   [x] Redis reports `subscribers: 1`
-   [x] Python receives PDF request
-   [x] ImageKit PDF download works
-   [x] PDF parsing works
-   [x] Chunking works
-   [x] Gemini embedding generation works
-   [x] ChromaDB storage works
-   [x] MongoDB status reaches `COMPLETED`
-   [x] Python publishes PDF response
-   [x] Node receives PDF response
-   [x] Redis reconnect/resubscription works

### Stage 2 --- Chat

-   [ ] Node chat request
-   [ ] Python chat request
-   [ ] Chroma retrieval
-   [ ] LangGraph execution
-   [ ] Python chat response
-   [ ] Node response correlation
-   [ ] End-to-end answer
-   [ ] Sources
-   [ ] Suggested questions
-   [ ] Conversation memory

------------------------------------------------------------------------

## 11. Current Milestone

> **Milestone: Node.js ↔ Python AI communication established.**

> **Stage 1: PDF ingestion and vectorization --- VERIFIED ✅**

> **Next milestone: Stage 2 --- Chat Q&A communication and RAG
> end-to-end verification.**

Do not mark the chat communication layer as complete until a real
question has successfully traveled through:

``` text
Node → Redis → Python → Chroma/LangGraph → Redis → Node
```
