# 🤖 Multi-Agent AI System

<div align="center">

![Multi-Agent Banner](https://img.shields.io/badge/Architecture-Multi--Agent%20Orchestrator-blueviolet?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![LangChain & LangGraph](https://img.shields.io/badge/AI%20Framework-LangChain%20%7C%20LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Vector%20Store-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Groq](https://img.shields.io/badge/LLM-Groq%20%7C%20Google%20Gemini-F55036?style=for-the-badge)
![Tavily](https://img.shields.io/badge/Search-Tavily%20AI-0052CC?style=for-the-badge)

<br/>

**An enterprise-grade, high-throughput Multi-Agent AI platform combining Smart Intent Routing, Hybrid RAG (Semantic + BM25 + RRF), Real-time Web Intelligence, OCR Extraction, and Stateful LangGraph Workflows.**

*Developed by **Sachin***

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [System Architecture](#-system-architecture)
  - [Architectural Layers](#architectural-layers)
  - [High-Level Architecture Diagram](#high-level-architecture-diagram)
- [End-to-End Workflows](#-end-to-end-workflows)
  - [1. Intent Routing & Pipeline Dispatch Workflow](#1-intent-routing--pipeline-dispatch-workflow)
  - [2. Stateful LangGraph Cyclical Agent Workflow](#2-stateful-langgraph-cyclical-agent-workflow)
  - [3. Hybrid RAG (Dense + Sparse + RRF) Workflow](#3-hybrid-rag-dense--sparse--rrf-workflow)
  - [4. Ultra-Fast Web Intelligence & Tool Calling Workflow](#4-ultra-fast-web-intelligence--tool-calling-workflow)
  - [5. OCR Document Intelligence Workflow](#5-ocr-document-intelligence-workflow)
  - [6. Cross-Chat Memory & Session Persistence Workflow](#6-cross-chat-memory--session-persistence-workflow)
- [Key Features](#-key-features)
- [Agent Ecosystem & Routes](#-agent-ecosystem--routes)
- [Directory Structure](#-directory-structure)
- [API Reference](#-api-reference)
- [Environment Configuration](#-environment-configuration)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Running via Docker](#running-via-docker)
  - [510 MB Deployment Packaging](#510-mb-deployment-packaging)
- [Tech Stack](#-tech-stack)
- [License](#-license)

---

## 🌟 Overview

The **Multi-Agent AI System** is a unified AI orchestration platform engineered to solve multi-modal enterprise tasks with low latency and high accuracy. It dynamically routes user requests to specialized autonomous sub-agents:

1. **📄 Document Agent (RAG)**: Ingests PDFs, chunks content, computes vector embeddings, and performs Reciprocal Rank Fusion (RRF) hybrid search across MongoDB Vector Store.
2. **🌐 Web Intelligence Agent**: Executes sub-second live web queries and weather forecasts using the Tavily Search REST API and ScrapeGraphAI.
3. **💻 Software Engineering Agent**: Handles programming, algorithm design, script generation, and code refactoring.
4. **👁️ OCR & Vision Agent**: Extracts and analyzes text and structures from scanned images and document uploads.
5. **💬 Direct Conversational Agent**: Delivers rapid general knowledge and multi-turn conversations.

All responses are synthesized into clean, structured **ChatGPT-style Markdown**:
- `### 📌 Question Summary`
- `### 💡 Main Content`
- `### 📚 Sources & References`

---

## 🏗️ System Architecture

### Architectural Layers

The system is organized into 5 modular, decoupled layers:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PRESENTATION LAYER (Glassmorphism Dark-Mode UI / HTML5 / CSS3 / ES6+)    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. API GATEWAY & ROUTING (FastAPI / CORS Middleware / Lifespan Manager)     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. ORCHESTRATION & AGENT CORE                                               │
│    • Smart Intent Router (0ms Heuristic Regex + LLM Classifier)             │
│    • LangGraph Stateful Workflow (Cyclical State Graph & Condition Edges)   │
│    • LangChain Tool Calling Agent (Tavily REST + ScrapeGraphAI)             │
│    • Hybrid RAG Engine (BM25 Sparse + Dense Semantic + RRF Fusion)          │
│    • ChatGPT Structured Response Synthesizer                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. AI & LLM PROVIDERS                                                       │
│    • Groq Cloud (openai/gpt-oss-20b, llama-3.3-70b)                         │
│    • Google Gemini API (gemini-3.8-flash, gemini-3.5-flash)                 │
│    • Tavily AI Search Engine & ScrapeGraphAI Cloud                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. PERSISTENCE & DATA STORAGE                                               │
│    • MongoDB Atlas (Conversations, Chat Messages, Vector Chunks)            │
│    • Vector Index (768-dimensional Gemini Embeddings)                       │
│    • Document Upload Storage & In-Memory BM25 Corpus Index                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### High-Level Architecture Diagram

```mermaid
flowchart TB
    subgraph Frontend ["🖥️ User Interface Layer"]
        UI["Glassmorphism Web App<br/>(Markdown Streaming, OCR Viewer, Citations)"]
    end

    subgraph Gateway ["⚡ Gateway & Middleware"]
        API["FastAPI REST Gateway<br/>/api/v1/"]
        CORS["CORS & Lifespan Controller"]
        API --- CORS
    end

    subgraph RouterLayer ["🧠 Intent Routing Layer"]
        Router["Smart Intent Router<br/>(router.py)"]
        Heuristics{"Heuristic Pattern<br/>Match (0ms)?"}
        LLMClass["LLM Intent Classifier<br/>(Groq / Gemini)"]
        Router --> Heuristics
        Heuristics -- "Matched" --> RouteSelect["Resolved Intent<br/>(rag | toolcalling | coding | direct)"]
        Heuristics -- "Uncertain" --> LLMClass --> RouteSelect
    end

    subgraph Agents ["🤖 Specialized Multi-Agent Pipelines"]
        RAGAgent["📄 Document RAG Agent<br/>(hybrid_search.py)"]
        ToolAgent["🌐 Web Search Agent<br/>(agent.py & tools.py)"]
        CodeAgent["💻 Coding & Script Agent<br/>(orchestrator.py)"]
        DirectAgent["💬 Direct LLM Agent<br/>(orchestrator.py)"]
        GraphAgent["🔄 Stateful LangGraph<br/>(graph.py)"]
    end

    subgraph ToolsAndEngines ["🛠️ Retrieval & Tooling Engines"]
        TavilyTool["Tavily AI Search<br/>(REST API < 350ms)"]
        SGAITool["ScrapeGraphAI<br/>(SmartScraperGraph)"]
        BM25Engine["BM25 Sparse Keyword Matcher"]
        VectorEngine["MongoDB Atlas Vector Store<br/>(Cosine Similarity)"]
        GeminiEmbed["Gemini Embedder<br/>(text-embedding-004)"]
    end

    subgraph Persistence ["💾 Persistence & Memory"]
        MongoDB[(MongoDB Atlas DB)]
        GlobalMem["Global Cross-Chat Memory<br/>(global_memory.py)"]
        MongoDB --- GlobalMem
    end

    subgraph Synthesizer ["✨ Structured Synthesis Layer"]
        ChatGPTFormatter["ChatGPT-Style Markdown Synthesizer<br/>(Summary + Content + References)"]
    end

    UI -->|HTTP / JSON| API
    API --> RouterLayer
    RouteSelect -->|rag| RAGAgent
    RouteSelect -->|toolcalling| ToolAgent
    RouteSelect -->|coding| CodeAgent
    RouteSelect -->|direct| DirectAgent
    API -.->|Stateful Graph| GraphAgent

    RAGAgent --> GeminiEmbed --> VectorEngine
    RAGAgent --> BM25Engine
    VectorEngine --> MongoDB
    ToolAgent --> TavilyTool
    ToolAgent --> SGAITool

    RAGAgent --> ChatGPTFormatter
    ToolAgent --> ChatGPTFormatter
    CodeAgent --> ChatGPTFormatter
    DirectAgent --> ChatGPTFormatter
    GraphAgent --> ChatGPTFormatter

    GlobalMem -.-> RouterLayer
    GlobalMem -.-> ChatGPTFormatter

    ChatGPTFormatter -->|Formatted Response| UI
```

---

## 🔄 End-to-End Workflows

### 1. Intent Routing & Pipeline Dispatch Workflow

The request lifecycle executes with sub-millisecond heuristic classification before dispatching to the target pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User / Frontend
    participant API as ⚡ FastAPI Gateway
    participant Mem as 🧠 Global Memory
    participant Router as 🎯 Intent Router
    participant Agent as 🤖 Target Agent
    participant LLM as ⚡ Groq / Gemini
    participant DB as 💾 MongoDB

    User->>API: POST /api/v1/chat { prompt, conversation_id }
    API->>Mem: Fetch Global Cross-Chat Context (MongoDB)
    Mem-->>API: Returns Global Context Summary
    API->>Router: classify_intent(prompt)
    
    alt Heuristic Match (Regex: Weather, Code, PDF, etc.)
        Router-->>API: Return Intent (Confidence: 0.95-0.98) in 0ms
    else General / Ambiguous Prompt
        Router->>LLM: Classify Intent Prompt
        LLM-->>Router: JSON { intent, confidence, reasoning }
        Router-->>API: Return Intent
    end

    API->>Agent: Execute Selected Pipeline (RAG / Tool / Code / Direct)
    Agent->>LLM: Inference / Tool Calls / Retrieval
    LLM-->>Agent: Raw Results
    Agent->>LLM: Synthesize into 3 ChatGPT Markdown Sections
    LLM-->>Agent: Structured Response
    Agent->>DB: Save User & Assistant Message Turn
    Agent-->>API: Return RouterExecutionResult
    API-->>User: HTTP 200 { response, metadata, sources }
```

---

### 2. Stateful LangGraph Cyclical Agent Workflow

The LangGraph engine maintains conversation states across multi-step execution graphs:

```mermaid
stateDiagram-v2
    [*] --> InitializeState: User Prompt & History Received
    InitializeState --> CheckIntent: Load State (messages, active_route, iter_count)
    
    state CheckIntent <<choice>>
    CheckIntent --> ExecuteTool: Intent == 'toolcalling'
    CheckIntent --> RetrieveRAG: Intent == 'rag'
    CheckIntent --> GenerateCode: Intent == 'coding'
    CheckIntent --> DirectChat: Intent == 'direct'
    
    ExecuteTool --> EvaluateToolOutput: Execute Tavily Search / Scraper
    RetrieveRAG --> EvaluateRAGOutput: Semantic + BM25 Fusion Search
    GenerateCode --> SynthesizeResponse: Generate Code & Architecture
    DirectChat --> SynthesizeResponse: Generate Conversational Output

    state EvaluateToolOutput <<choice>>
    EvaluateToolOutput --> ExecuteTool: Tool requested additional data (Iter < Max)
    EvaluateToolOutput --> SynthesizeResponse: Search Results Ready

    state EvaluateRAGOutput <<choice>>
    EvaluateRAGOutput --> SynthesizeResponse: Document Chunks Ranked

    SynthesizeResponse --> FormatMarkdown: Structure into 3 Sections (Summary, Content, Sources)
    FormatMarkdown --> UpdateMemory: Persist State to MongoDB
    UpdateMemory --> [*]: Return Final Response to Client
```

---

### 3. Hybrid RAG (Dense + Sparse + RRF) Workflow

The Document Intelligence engine indexes PDFs and performs hybrid rank fusion:

$$\text{RRF Score}(d) = \sum_{m \in M} \frac{1}{k + r_m(d)} \quad (k = 60)$$

```mermaid
flowchart LR
    subgraph Ingestion ["📥 Ingestion Phase"]
        PDF[📄 Upload PDF Document] --> Loader[PyPDF Extractor]
        Loader --> Chunker[Recursive Text Chunker<br/>Chunk: 800, Overlap: 150]
        Chunker --> Embedder[Gemini Embedding 768-d]
        Embedder --> Atlas[(MongoDB Atlas<br/>Vector Store)]
        Chunker --> InMemBM25[(In-Memory BM25<br/>Inverted Index)]
    end

    subgraph QueryPath ["🔍 Query & Retrieval Phase"]
        Query[❓ User Query] --> QEmbed[Embed Query via Gemini]
        QEmbed --> DenseSearch[Dense Vector Search<br/>Top-K Cosine Similarity]
        Query --> SparseSearch[Sparse BM25 Search<br/>Top-K Keyword Match]
        
        DenseSearch --> DenseRanks[Dense Rankings]
        SparseSearch --> SparseRanks[Sparse Rankings]
        
        DenseRanks & SparseRanks --> RRF[🔀 Reciprocal Rank Fusion<br/>RRF Score Calculation]
        RRF --> ReRanked[Top Re-Ranked Chunks]
        ReRanked --> ContextBuilder[Context Builder + System Prompt]
        ContextBuilder --> RAGLLM[LLM Synthesis Engine]
        RAGLLM --> RAGOut[📋 Grounded Answer with Citations]
    end
```

---

### 4. Ultra-Fast Web Intelligence & Tool Calling Workflow

Optimized to return live internet intelligence in under 1.5 seconds:

```mermaid
sequenceDiagram
    autonumber
    actor Client as 🌐 Web Client
    participant Agent as 🤖 LangChainToolAgent
    participant Tavily as ⚡ Tavily REST API (<350ms)
    participant Scraper as 🕸️ ScrapeGraphAI Graph
    participant Synth as ✨ ChatGPT Synthesizer

    Client->>Agent: "What is the current weather and AQI in Chennai?"
    Agent->>Agent: Inspect bound tools (tavily_search_tool, scrapegraph_web_scraper)
    Agent->>Tavily: POST https://api.tavily.com/search (basic depth)
    
    alt Tavily Success (< 350ms)
        Tavily-->>Agent: JSON { answer, results: [titles, urls, snippets] }
    else Fallback to Scraping
        Agent->>Scraper: Execute SmartScraperGraph / HTTP Fallback
        Scraper-->>Agent: Extracted Web Text
    end

    Agent->>Synth: _synthesize_chatgpt_response(prompt, tool_data)
    Synth->>Synth: Format into Summary, Main Content (Emojis/Numbers), Sources
    Synth-->>Agent: Synthesized Markdown
    Agent-->>Client: Real-Time Grounded Response
```

---

### 5. OCR Document Intelligence Workflow

```mermaid
flowchart TD
    ImgUpload[📷 Upload Image / Document] --> OCRRoute[FastAPI /api/v1/ocr/extract]
    OCRRoute --> Validator{Validate Image Format<br/>PNG, JPG, WEBP, PDF}
    Validator -- Valid --> PreProcessor[Image Pre-Processing & Normalization]
    PreProcessor --> VisionEngine[Gemini Vision / EasyOCR Engine]
    VisionEngine --> TextExtract[Extracted Text & Table Structures]
    TextExtract --> JSONResp[JSON Response + Confidence Score]
    JSONResp --> UIViewer[🖥️ Frontend OCR Split-Viewer & Chat Context]
```

---

### 6. Cross-Chat Memory & Session Persistence Workflow

```mermaid
flowchart LR
    Msg[💬 User Message] --> SessionHandler[Session Manager]
    SessionHandler --> MongoColl[(MongoDB Collection: conversations)]
    
    MongoColl --> ActiveChat[Active Conversation History<br/>Last 4 Turns]
    MongoColl --> GlobalAggregator[Global Memory Aggregator]
    
    GlobalAggregator --> CrossChatCtx[Cross-Chat Summary Context<br/>Pinned User Preferences, Facts]
    
    ActiveChat & CrossChatCtx --> AgentPrompt[Agent System Prompt Injection]
    AgentPrompt --> ModelInference[LLM Context-Aware Inference]
```

---

## ✨ Key Features

- **⚡ Sub-Second Latency Optimization**: Heuristic classification routes common intents (weather, news, code, documents) in **0ms** before invoking LLM fallbacks.
- **🔍 Hybrid Search with RRF**: Combines dense semantic vector retrieval with sparse BM25 keyword matching via Reciprocal Rank Fusion ($RRF$) for high RAG precision.
- **🌐 Real-Time Web Intelligence**: Fast REST search integration (< 350ms) using Tavily AI and deep web extraction via ScrapeGraphAI graphs.
- **🧠 Cross-Chat Session Memory**: Persistent conversation history stored in MongoDB Atlas with cross-chat global context awareness.
- **🖼️ OCR Document Intelligence**: Full OCR pipeline to parse uploaded screenshots, receipts, invoices, and PDF pages.
- **🎨 Modern Dark Mode UI**: Glassmorphism interface with real-time markdown streaming, code highlighting, copy widgets, citations, and OCR side panels.
- **📦 Cloud Deployment Optimized**: Pre-configured for containers and lightweight deployments under **510 MB**.

---

## 🤖 Agent Ecosystem & Routes

| Route | Trigger Keywords / Scenarios | Powered By | Output Format |
| :--- | :--- | :--- | :--- |
| **`rag`** | `pdf`, `resume`, `uploaded`, `document`, `file content` | MongoDB Vector Store + Gemini Embeddings | Document chunks, RRF rank, synthesized answer |
| **`toolcalling`** | `weather`, `latest`, `recent`, `news`, `today`, `stock`, `prices` | Tavily Search REST + ScrapeGraphAI | Live data, temperature, humidity, web citations |
| **`coding`** | `code`, `python`, `javascript`, `debug`, `fastapi`, `react` | Groq / Gemini Software Agent | Clean fenced code blocks with documentation |
| **`direct`** | General questions, casual conversation, greetings | Groq `openai/gpt-oss-20b` / Gemini `gemini-3.8-flash` | Direct conversational markdown |

---

## 📂 Directory Structure

```text
Multi-Agent/
├── Dockerfile                  # Multi-stage production container configuration
├── .dockerignore               # Container build exclusions
├── .gitignore                  # Git exclusions (.env, venvs, cache, etc.)
├── package_deploy.py           # Deployment compression script (< 510 MB)
├── backend/
│   ├── requirements.txt        # Python dependencies
│   ├── server.py               # Uvicorn entry point
│   ├── app/
│   │   ├── main.py             # FastAPI application gateway & CORS
│   │   ├── ai/
│   │   │   ├── agent.py        # LangChain tool calling agent & synthesis
│   │   │   ├── global_memory.py# Cross-chat MongoDB memory aggregator
│   │   │   ├── graph.py        # LangGraph stateful workflow definition
│   │   │   ├── orchestrator.py # Multi-agent orchestrator & pipeline dispatch
│   │   │   ├── router.py       # Heuristic & LLM smart intent router
│   │   │   └── tools.py        # Tavily, ScrapeGraphAI, & Vector tools
│   │   ├── core/
│   │   │   └── config.py       # Pydantic settings & model fallback tiers
│   │   ├── db/
│   │   │   └── __init__.py     # MongoDB Atlas client & health ping
│   │   ├── rag/
│   │   │   ├── embedder.py     # Gemini text embeddings
│   │   │   ├── hybrid_search.py# BM25 + Semantic + RRF hybrid engine
│   │   │   ├── pdf_loader.py   # PDF text extraction
│   │   │   ├── text_chunker.py # Recursive text chunking with overlap
│   │   │   └── vector_store.py # MongoDB Atlas Vector Search client
│   │   └── routes/
│   │       ├── agent.py        # Direct agent execution route
│   │       ├── chat.py         # Main chat endpoint with memory
│   │       ├── conversations.py# Session and history management
│   │       ├── langgraph.py    # LangGraph state machine chat route
│   │       ├── ocr.py          # OCR text extraction route
│   │       ├── rag.py          # RAG query and index endpoints
│   │       ├── router.py       # Intent classification endpoint
│   │       └── upload.py       # File upload and vector ingestion
└── frontend/
    ├── app.html                # Main web application interface
    ├── app.css                 # Glassmorphism dark mode stylesheet
    ├── app.js                  # Frontend state machine & API client
    ├── index.html              # Landing page
    ├── package.json            # Vite dev configuration
    └── script.js               # UI interaction handlers
```

---

## 📡 API Reference

### Core Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/chat` | Primary chat endpoint with intent routing & session memory |
| `POST` | `/api/v1/router/execute` | Classifies prompt intent (`rag`, `toolcalling`, `coding`, `direct`) and executes |
| `POST` | `/api/v1/rag/query` | Directly queries vector store using Hybrid RAG Search |
| `POST` | `/api/v1/upload` | Uploads PDF documents, generates embeddings, and indexes chunks |
| `POST` | `/api/v1/ocr/extract` | Extracts text from uploaded image files |
| `POST` | `/api/v1/langgraph/chat` | Executes LangGraph state machine workflow |
| `GET` | `/api/v1/conversations` | Fetches conversation list and chat history |
| `GET` | `/health` | Health status and MongoDB Atlas connection ping |

---

## ⚙️ Environment Configuration

Create a `.env` file inside the `backend/` directory:

```env
# Google Gemini API
GEMINI_API_KEY="your-gemini-api-key"

# Groq API
GROQ_API_KEY="your-groq-api-key"

# Tavily AI Search (for ultra-fast real-time web intelligence)
TAVILY_API_KEY="your-tavily-api-key"

# ScrapeGraphAI (optional, for cloud-based scraping)
SGAI_API_KEY="your-scrapegraph-api-key"

# MongoDB Atlas Vector Store Configuration
MONGODB_URI="mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB_NAME="multiagent_db"
MONGODB_COLLECTION_NAME="vector_chunks"
VECTOR_INDEX_NAME="vector_index"

# Model Tier Configuration
DEFAULT_MODEL="groq/openai/gpt-oss-20b"
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** (for frontend development server)
- **MongoDB Atlas** cluster with Vector Search enabled

---

### Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the FastAPI Server**:
   ```bash
   python server.py
   # Or using uvicorn directly:
   uvicorn app.main:app --host 0.0.0.0 --port 8990 --reload
   ```

   The backend API will be live at `http://localhost:8990`. Interactive API Docs are available at `http://localhost:8990/docs`.

---

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies & start the dev server**:
   ```bash
   npm install
   npm run dev
   ```

   Access the application UI at `http://localhost:5173`.

---

### Running via Docker

```bash
# Build the Docker image
docker build -t multi-agent-system:latest .

# Run the container
docker run -p 8990:8990 --env-file backend/.env multi-agent-system:latest
```

---

### 510 MB Deployment Packaging

For storage-constrained deployments (e.g. 512 MB limits), run the custom packaging script:

```bash
python package_deploy.py
```

This creates an optimized `deployment_package.zip` (under ~10 MB compressed) excluding heavy caches, virtual environments, and node modules.

---

## 🛠️ Tech Stack

- **Backend**: [FastAPI](https://fastapi.tiangolo.com/), [Pydantic v2](https://docs.pydantic.dev/), [Uvicorn](https://www.uvicorn.org/)
- **AI & Orchestration**: [LangChain](https://python.langchain.com/), [LangGraph](https://langchain-ai.github.io/langgraph/), [LiteLLM](https://litellm.ai/)
- **LLM Providers**: [Groq](https://groq.com/) (`openai/gpt-oss-20b`), [Google Gemini](https://ai.google.dev/) (`gemini-3.8-flash`)
- **Vector Database**: [MongoDB Atlas Vector Search](https://www.mongodb.com/products/platform/atlas-vector-search)
- **Web Search & Scraping**: [Tavily AI Search](https://tavily.com/), [ScrapeGraphAI](https://scrapegraphai.com/)
- **Frontend**: Vanilla HTML5, Modern CSS3 (Glassmorphism, Dark Mode), JavaScript (ES6+)

---

## 📄 License

This project is licensed under the MIT License. Developed with ❤️ by **Sachin**.