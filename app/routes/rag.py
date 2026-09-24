import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import litellm

from app.core.config import settings
from app.rag.embedder import EmbeddedChunk, GeminiEmbedder
from app.rag.pdf_loader import PDFLoader
from app.rag.text_chunker import RecursiveCharacterTextSplitter
from app.rag.vector_store import SearchResult, vector_store

router = APIRouter(prefix="/rag", tags=["RAG Pipeline"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "upload")


class ChunkRequest(BaseModel):
    filename: str = Field(
        ...,
        description="PDF filename stored in upload folder",
        json_schema_extra={"example": "Sachinkannan_Resume.pdf"},
    )
    chunk_size: int = Field(
        default=500,
        gt=0,
        description="Maximum character length per chunk",
        json_schema_extra={"example": 500},
    )
    chunk_overlap: int = Field(
        default=50,
        ge=0,
        description="Character overlap between consecutive chunks",
        json_schema_extra={"example": 50},
    )


class EmbedRequest(BaseModel):
    filename: str = Field(
        ...,
        description="PDF filename stored in upload folder",
        json_schema_extra={"example": "Sachinkannan_Resume.pdf"},
    )
    chunk_size: int = Field(default=500, gt=0, json_schema_extra={"example": 500})
    chunk_overlap: int = Field(default=50, ge=0, json_schema_extra={"example": 50})
    model: Optional[str] = Field(
        default="gemini/gemini-embedding-001",
        description="Gemini embedding model name",
        json_schema_extra={"example": "gemini/gemini-embedding-001"},
    )


class EmbedResponse(BaseModel):
    filename: str
    total_chunks: int
    vector_dimension: int
    embedding_model: str
    total_vectors_in_store: int
    status: str = "success"


class SearchRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        description="User search query to match against embedded document chunks",
        json_schema_extra={"example": "What skills does Sachin have in Python and FastAPI?"},
    )
    top_k: int = Field(default=3, gt=0, description="Number of top matching chunks to retrieve")
    model: Optional[str] = Field(default="gemini/gemini-embedding-001", json_schema_extra={"example": "gemini/gemini-embedding-001"})


class SearchResponse(BaseModel):
    query: str
    top_k: int
    results: List[SearchResult]
    status: str = "success"


class RAGQARequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        description="Question to ask about the uploaded document",
        json_schema_extra={"example": "Summarize Sachinkannan's work experience and top skills."},
    )
    mode: Optional[str] = Field(default="Fast", description="LLM mode tier: 'Slow' (Gemini), 'Fast' (Groq), 'Pro' (Mistral)")
    top_k: int = Field(default=3, gt=0, description="Number of context chunks to retrieve")


class RAGQAResponse(BaseModel):
    query: str
    answer: str
    retrieved_chunks: List[SearchResult]
    mode_used: str
    model_used: str
    status: str = "success"


@router.get("/documents", summary="List all uploaded PDF documents available for RAG")
def list_uploaded_documents():
    """Returns list of PDF files stored in upload directory."""
    if not os.path.exists(UPLOAD_DIR):
        return {"documents": [], "total": 0}

    files = [f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith(".pdf")]
    documents = []
    for f in files:
        fpath = os.path.join(UPLOAD_DIR, f)
        documents.append({
            "filename": f,
            "size_bytes": os.path.getsize(fpath),
            "path": fpath,
        })
    return {"documents": documents, "total": len(documents)}


@router.post("/chunk", summary="Stage 2: Chunk document text using RecursiveCharacterTextSplitter")
def chunk_document(request: ChunkRequest):
    """Loads PDF from upload folder and recursively splits text into chunks."""
    file_path = os.path.join(UPLOAD_DIR, request.filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{request.filename}' not found in upload directory.",
        )

    try:
        loaded_doc = PDFLoader.load_file(file_path)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )
        chunks = splitter.split_text(
            text=loaded_doc.full_text,
            source_name=request.filename,
            base_metadata={"filename": request.filename, "num_pages": loaded_doc.num_pages},
        )
        return {
            "filename": request.filename,
            "total_characters": loaded_doc.total_characters,
            "total_chunks": len(chunks),
            "chunk_size": request.chunk_size,
            "chunk_overlap": request.chunk_overlap,
            "chunks": chunks,
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chunking failed: {str(e)}",
        )


@router.post("/embed", response_model=EmbedResponse, summary="Stage 3: Generate Gemini embeddings & index chunks in vector store")
async def embed_document(request: EmbedRequest):
    """
    RAG Stage 3: Gemini Embeddings & Vector Indexing
    - Loads PDF document
    - Splits text into recursive chunks
    - Generates 3072-dimensional vector embeddings using Gemini (gemini/gemini-embedding-001)
    - Stores vectors in vector index
    """
    file_path = os.path.join(UPLOAD_DIR, request.filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{request.filename}' not found in upload directory.",
        )

    try:
        # Stage 1: Load
        loaded_doc = PDFLoader.load_file(file_path)

        # Stage 2: Chunk
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
        )
        chunks = splitter.split_text(
            text=loaded_doc.full_text,
            source_name=request.filename,
            base_metadata={"filename": request.filename},
        )

        if not chunks:
            raise HTTPException(status_code=400, detail="No text chunks generated from PDF.")

        # Stage 3: Generate Gemini Embeddings
        embedder_model = request.model or "gemini/gemini-embedding-001"
        embedder = GeminiEmbedder(model=embedder_model)
        chunk_texts = [c.text for c in chunks]

        vector_embeddings = await embedder.aembed_texts(chunk_texts)

        # Build EmbeddedChunk objects
        embedded_chunks: List[EmbeddedChunk] = []
        vector_dim = len(vector_embeddings[0]) if vector_embeddings else 0

        for chunk, emb_vec in zip(chunks, vector_embeddings):
            embedded_chunks.append(
                EmbeddedChunk(
                    chunk_id=chunk.chunk_id,
                    text=chunk.text,
                    embedding=emb_vec,
                    metadata=chunk.metadata,
                )
            )

        # Store vectors
        vector_store.add_chunks(embedded_chunks)

        return EmbedResponse(
            filename=request.filename,
            total_chunks=len(embedded_chunks),
            vector_dimension=vector_dim,
            embedding_model=embedder_model,
            total_vectors_in_store=vector_store.count(),
            status="success",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini embedding failed: {str(e)}",
        )


@router.post("/search", response_model=SearchResponse, summary="Stage 3: Vector similarity search over embedded document chunks")
async def vector_search(request: SearchRequest):
    """
    RAG Stage 3: Vector Cosine Similarity Search
    - Embeds user search query using Gemini embedding model
    - Computes cosine similarity scores against indexed document chunks
    - Returns top_k matching chunks
    """
    if vector_store.count() == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vector store is empty. Please call /rag/embed first to index document chunks.",
        )

    try:
        embedder = GeminiEmbedder(model=request.model or "gemini/gemini-embedding-001")
        query_vectors = await embedder.aembed_texts([request.query])
        if not query_vectors:
            raise HTTPException(status_code=500, detail="Failed to embed search query.")

        search_results = vector_store.similarity_search(query_vectors[0], top_k=request.top_k)

        return SearchResponse(
            query=request.query,
            top_k=request.top_k,
            results=search_results,
            status="success",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vector search failed: {str(e)}",
        )


@router.post("/qa", response_model=RAGQAResponse, summary="Stage 4: End-to-End RAG Q&A Grounded in Document Context")
async def rag_qa(request: RAGQARequest):
    """
    RAG Stage 4: Document Question Answering
    - Retrieves top_k relevant document chunks via Gemini vector search
    - Constructs context-augmented prompt
    - Generates grounded answer using configured LLM tier (Fast / Slow / Pro) with automatic fallback
    """
    if vector_store.count() == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vector store is empty. Please upload and embed a document via /rag/embed first.",
        )

    # 1. Vector Search Retrieval
    embedder = GeminiEmbedder(model="gemini/gemini-embedding-001")
    query_vectors = await embedder.aembed_texts([request.query])
    results = vector_store.similarity_search(query_vectors[0], top_k=request.top_k)

    if not results:
        raise HTTPException(status_code=404, detail="No relevant context found in vector store.")

    # 2. Build Context Prompt
    context_str = "\n\n".join([f"[Context Chunk {i+1} (Score: {r.score})]:\n{r.text}" for i, r in enumerate(results)])
    system_prompt = (
        "You are an intelligent RAG assistant. Answer the user's question accurately and concisely "
        "based strictly on the provided document context chunks. If the context does not contain enough "
        "information, state that clearly."
    )
    user_prompt = f"DOCUMENT CONTEXT:\n{context_str}\n\nUSER QUESTION:\n{request.query}"

    # 3. LLM Generation with Fallback
    selected_mode = (request.mode or "Fast").strip()
    candidate_models = settings.FALLBACK_SEQUENCES.get(selected_mode, settings.FALLBACK_SEQUENCES["Fast"])

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    response = None
    used_model = None

    for model_name in candidate_models:
        try:
            response = await litellm.acompletion(model=model_name, messages=messages)
            used_model = model_name
            break
        except Exception:
            continue

    if not response or not used_model:
        raise HTTPException(status_code=500, detail="All LLM models failed to generate RAG answer.")

    return RAGQAResponse(
        query=request.query,
        answer=response.choices[0].message.content,
        retrieved_chunks=results,
        mode_used=selected_mode,
        model_used=used_model,
        status="success",
    )


class HybridSearchRequest(BaseModel):
    query: str = Field(
        ...,
        description="Query text for Hybrid Search (Semantic + BM25 + RRF)",
        json_schema_extra={"example": "What are the candidate's core skills?"},
    )
    top_k: int = Field(default=3, ge=1, le=10, description="Top K results to retrieve", json_schema_extra={"example": 3})
    rrf_k: int = Field(default=60, ge=1, le=100, description="RRF constant k (default 60)", json_schema_extra={"example": 60})


@router.post("/hybrid-search", summary="Perform Hybrid Search (Semantic + BM25 + RRF)")
def hybrid_search(request: HybridSearchRequest):
    """
    Executes Hybrid Search combining:
    1. Semantic Vector Search (Dense Embedding Cosine Similarity)
    2. BM25 Keyword Search (Term Frequency & Inverse Document Frequency)
    3. Reciprocal Rank Fusion (RRF Re-ranking)
    """
    try:
        from app.rag.hybrid_search import HybridSearchEngine
        engine = HybridSearchEngine(rrf_k=request.rrf_k)
        results = engine.search(query=request.query, top_k=request.top_k)
        return {
            "query": request.query,
            "search_mode": "hybrid_semantic_bm25_rrf",
            "top_k": request.top_k,
            "rrf_k": request.rrf_k,
            "total_results": len(results),
            "results": [r.model_dump() for r in results],
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hybrid Search failed: {str(e)}")

