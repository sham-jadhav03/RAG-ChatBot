# AI Full Stack Developer Assignment

## PDF Knowledge Base AI Chatbot (RAG System)

### Objective
Build an AI-powered Knowledge Base Chatbot where an administrator can upload PDF documents that become the AI's knowledge base. Users can ask questions through a public chatbot interface, and the AI should answer questions using the uploaded documents while suggesting relevant follow-up questions.

The project must use a microservice architecture with a separate Node.js backend and Python AI service communicating through Redis Pub/Sub.

## Mandatory Tech Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- SHADCN UI

### Backend
- Node.js
- NestJS or Express
- TypeScript

### AI Service
- Python
- FastAPI
- LangChain
- LangGraph

### Database
- PostgreSQL or MongoDB

### Vector Database (Free)
- ChromaDB (Preferred)
- FAISS
- Qdrant

### Communication
- Redis Pub/Sub (Mandatory)

## System Architecture

```text
Next.js Frontend
│
▼
Node.js Backend (TypeScript)
│
Redis Pub/Sub
│
▼
Python AI Service (LangChain + LangGraph)
│
▼
Vector Database (Chroma / FAISS / Qdrant)
│
▼
Database (PostgreSQL / MongoDB)
```

## Module 1 — Admin Panel

### Authentication
- Admin Login
- Secure Authentication

### Dashboard
Display:
- Total Uploaded PDFs
- Total Chat Sessions
- Total Questions Asked
- Recent Uploaded Documents

### Knowledge Base Management
Admin should be able to:
- Upload PDF files
- View uploaded PDFs
- Search uploaded PDFs
- Delete PDFs
- Reprocess PDFs

After uploading a PDF, the system should automatically:
- Extract text
- Split into chunks
- Generate embeddings
- Store vectors in the Vector Database
- Save metadata in the Database

## Module 2 — Public AI Chat

- No authentication required.
- Create a ChatGPT-style chatbot interface.

### Features
- Ask questions
- Streaming responses
- Markdown rendering
- Typing indicator
- Responsive UI

### AI Responses
Each response should display:
- AI Answer
- Source Document Name
- Page Number (if available)

### Suggested Follow-up Questions (Mandatory)
After every response, automatically generate 3–5 relevant follow-up questions based on the conversation and retrieved knowledge.

Example:
- What happens if I forget my password?
- How can I update my email?
- Where can I change my profile settings?

### Conversation Memory
The chatbot should remember the current conversation so follow-up questions work naturally.

## Python AI Service

The AI service must be responsible for:
- PDF Processing
- Document Chunking
- Embedding Generation
- Vector Search
- RAG Pipeline
- Answer Generation
- Suggested Question Generation

Must use:
- LangChain
- LangGraph
- FastAPI

### LangGraph Workflow (Mandatory)

```text
Receive Question
│
▼
Retrieve Context
│
▼
Generate Answer
│
▼
Generate Suggested Questions
│
▼
Return Response
```

## Redis Pub/Sub Communication (Mandatory)

The Node.js backend and Python AI service must communicate using Redis Pub/Sub.

### Expected flow

```text
Frontend
│
▼
Node.js Backend
│
Publish Request
│
Redis Pub/Sub
│
Python AI Service
│
Generate Response
│
Publish Response
│
Node.js Backend
│
Frontend
```

> Direct communication between the Node.js backend and Python AI service for AI processing is not allowed.

## Database Design

### Minimum collections/tables

#### Users
- id
- email
- password

#### Documents
- id
- file name
- upload date
- processing status

#### Chats
- id
- session id
- question
- answer
- timestamp

## Required APIs

### Admin APIs
- Login
- Upload PDF
- List PDFs
- Delete PDF
- Reprocess PDF

### Chat APIs
- Ask Question
- Chat History

## Project Structure

- frontend/
- backend/
- python-ai/
- shared/
- README.md
- docker-compose.yml (Optional)

## Evaluation Criteria (100 Marks)

| Criteria | Marks |
|---|---|
| Next.js Frontend | 15 |
| Node.js Backend | 15 |
| Python AI Service | 20 |
| LangChain Implementation | 15 |
| LangGraph Implementation | 15 |
| Redis Pub/Sub Integration | 10 |
| Database & Vector DB Design | 5 |
| Code Quality & Folder Structure | 5 |

## Submission Requirements

Candidates must submit the following:
- Public GitHub Repository
- Complete source code
- README with setup instructions
● .env.example
● Database schema
● Architecture diagram
● API documentation
● A public Loom or YouTube video (5–10 minutes) demonstrating:
○ Project overview
○ Folder structure
○ Codebase walkthrough
○ System architecture
○ Redis communication
○ LangGraph workflow
○ PDF upload process
○ AI chatbot working with follow up questions showing pdfs uploaded
○ Suggested questions feature
Important Notes
1. The project must be developed using TypeScript for the frontend and Node.js backend.
2. The AI service must be developed in Python using LangChain and LangGraph.
3. Redis Pub/Sub is mandatory for communication between the backend and AI service.
4. A free vector database must be used.
5. The chatbot must answer questions using the uploaded PDF knowledge base.
6. Suggested follow-up questions are mandatory.
7. The project should follow clean architecture and best coding practices.
8. Proper error handling and validation should be implemented.
Submission Deadline
Duration: 4 Days (TILL 6 August 12pm ) from the date of assignment.
Failure to submit all required deliverables, including the public GitHub repository and demonstration video, may result in disqualification from the evaluation process