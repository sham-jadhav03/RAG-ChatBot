# Python AI Service

The Python AI Service is responsible for all AI-related operations including PDF processing, document chunking, embedding generation, vector storage, vector search, RAG, answer generation, and suggested question generation.

The service is built using:

* Python
* FastAPI
* LangChain
* LangGraph
* ChromaDB
* Redis Pub/Sub

## Python AI Service Structure

```text
python-ai/
├── app/
│   ├── main.py                    # FastAPI application
│   ├── config.py                  # Environment and configuration
│   ├── redis_worker.py            # Redis listener and request dispatcher
│   │
│   ├── graph/
│   │   ├── state.py               # LangGraph state
│   │   ├── nodes.py               # Retrieve, answer, suggestions
│   │   └── build_graph.py         # Build and compile LangGraph
│   │
│   ├── ingestion/
│   │   ├── loader.py              # Load and extract PDF content
│   │   ├── chunker.py             # Split extracted text into chunks
│   │   ├── embedder.py            # Generate embeddings
│   │   └── processor.py           # Orchestrate PDF processing
│   │
│   └── vectorstore/
│       └── chroma_client.py       # ChromaDB operations
│
├── chroma_data/                   # Persistent ChromaDB storage
├── uploads/                       # Uploaded PDF files
├── requirements.txt
└── .env.example
```

## Overall Python AI Flow

```text
Node.js Backend
       │
       │ Redis Pub/Sub
       ▼
Python AI Service
       │
       ├── PDF Processing Request
       │       │
       │       ▼
       │   processor.py
       │       ↓
       │   loader.py
       │       ↓
       │   chunker.py
       │       ↓
       │   embedder.py
       │       ↓
       │   chroma_client.py
       │       ↓
       │    ChromaDB
       │
       └── Chat Request
               │
               ▼
           LangGraph
               │
               ▼
        Retrieve Context
               │
               ▼
        Generate Answer
               │
               ▼
      Generate Suggestions
               │
               ▼
            Response
```

## PDF Ingestion Flow

```text
Receive PDF Request
        ↓
redis_worker.py
        ↓
ingestion/processor.py
        ↓
Load PDF
        ↓
Extract Text
        ↓
Split Text into Chunks
        ↓
Generate Embeddings
        ↓
Store Chunks + Embeddings + Metadata
        ↓
ChromaDB
        ↓
Publish Processing Result
        ↓
Node.js Backend
```

### Ingestion Responsibilities

| File               | Responsibility                                      |
| ------------------ | --------------------------------------------------- |
| `redis_worker.py`  | Receives the PDF processing request                 |
| `processor.py`     | Orchestrates the complete ingestion pipeline        |
| `loader.py`        | Loads the PDF and extracts text/page information    |
| `chunker.py`       | Splits extracted text into chunks                   |
| `embedder.py`      | Generates embeddings for chunks                     |
| `chroma_client.py` | Stores chunks, embeddings, and metadata in ChromaDB |

## Chat / RAG Flow

```text
Receive Chat Request
        ↓
redis_worker.py
        ↓
LangGraph
        ↓
Retrieve Context
        ↓
Generate Answer
        ↓
Generate Suggested Questions
        ↓
Prepare Response
        ↓
redis_worker.py
        ↓
Redis
        ↓
Node.js Backend
```

### LangGraph Workflow

```text
Question
   ↓
Retrieve Context
   ↓
Generate Answer
   ↓
Generate Suggested Questions
   ↓
Return Response
```

### Retrieve Context

```text
User Question
      ↓
Generate Query Embedding
      ↓
Search ChromaDB
      ↓
Retrieve Relevant Chunks
      ↓
Return Context + Metadata
```

The retrieved metadata can include:

* Document ID
* Document name
* Page number
* Chunk content

### Generate Answer

```text
Question
   +
Retrieved Context
   +
Conversation History
        ↓
       LLM
        ↓
      Answer
```

### Generate Suggested Questions

```text
Question
   +
Answer
   +
Retrieved Context
   +
Conversation History
        ↓
       LLM
        ↓
3–5 Suggested Follow-up Questions
```

## Node.js ↔ Python AI Communication

Node.js Backend and Python AI Service communicate **only through Redis Pub/Sub**.

Direct communication between Node.js and Python for AI processing is not used.

```text
┌──────────────────┐
│  Node.js Backend │
└────────┬─────────┘
         │
         │ Publish Request
         ▼
┌──────────────────┐
│   Redis Pub/Sub  │
└────────┬─────────┘
         │
         │ Receive Request
         ▼
┌──────────────────────┐
│ Python AI Service    │
│                      │
│ redis_worker.py      │
│        ↓             │
│ PDF / LangGraph      │
│ Processing           │
└────────┬─────────────┘
         │
         │ Publish Response
         ▼
┌──────────────────┐
│   Redis Pub/Sub  │
└────────┬─────────┘
         │
         │ Receive Response
         ▼
┌──────────────────┐
│  Node.js Backend │
└──────────────────┘
```

## Redis Channels

```text
pdf_process_requests
pdf_process_responses

chat_requests
chat_responses
```

### PDF Processing Communication

```text
Node.js
   ↓
pdf_process_requests
   ↓
Python redis_worker.py
   ↓
PDF Ingestion Pipeline
   ↓
ChromaDB
   ↓
pdf_process_responses
   ↓
Node.js
```

### Chat Communication

```text
Node.js
   ↓
chat_requests
   ↓
Python redis_worker.py
   ↓
LangGraph
   ↓
chat_responses
   ↓
Node.js
```

## Responsibility Boundaries

### Node.js Backend

Responsible for:

* Authentication
* Users
* Documents
* Chat APIs
* MongoDB
* PDF upload management
* Redis communication

### Python AI Service

Responsible for:

* PDF processing
* Text extraction
* Chunking
* Embeddings
* ChromaDB
* Vector search
* RAG
* Answer generation
* Suggested questions
* LangGraph workflow

### Important Rule

```text
Node.js Backend
      ↕
   Redis Pub/Sub
      ↕
Python AI Service
```

Node.js and Python AI remain decoupled. Python AI does not directly call Node.js APIs for AI processing.
