import os
from typing import List, Optional
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from app.rag.pdf_loader import PDFLoader, PageContent
from app.rag.embedder import EmbeddedChunk, GeminiEmbedder
from app.rag.text_chunker import RecursiveCharacterTextSplitter
from app.rag.vector_store import vector_store
from app.core.config import settings

router = APIRouter(prefix="/upload", tags=["PDF Loader Stage"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "upload")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class PDFUploadResponse(BaseModel):
    filename: str
    num_pages: int
    total_characters: int
    pages: List[PageContent]
    full_text_preview: str
    file_path: str
    total_chunks: int = 0
    indexed: bool = False
    status: str = "success"


@router.post("/pdf", response_model=PDFUploadResponse, summary="Stage 1: Load and extract text from uploaded PDF")
@router.post("/pdf/", response_model=PDFUploadResponse, include_in_schema=False)
async def upload_pdf(file: UploadFile = File(...)):
    """
    RAG Stage 1: Load PDF File
    - Validates PDF format
    - Saves uploaded file to disk
    - Extracts page-by-page text content & character counts
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF files (.pdf) are supported.",
        )

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded PDF file is empty.",
            )

        # Save to disk
        save_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(save_path, "wb") as f:
            f.write(content)

        # Process with PDFLoader
        doc = PDFLoader.load_bytes(content, filename=file.filename)
        vector_store.remove_source(doc.filename)

        total_chunks = 0
        indexed = False
        if settings.GEMINI_API_KEY and doc.full_text.strip():
            splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
            chunks = splitter.split_text(
                text=doc.full_text,
                source_name=doc.filename,
                base_metadata={"filename": doc.filename, "num_pages": doc.num_pages},
            )
            if chunks:
                try:
                    embedder = GeminiEmbedder()
                    embeddings = await embedder.aembed_texts([chunk.text for chunk in chunks])
                    if embeddings and len(embeddings) == len(chunks):
                        embedded_chunks = [
                            EmbeddedChunk(chunk_id=chunk.chunk_id, text=chunk.text, embedding=embedding, metadata=chunk.metadata)
                            for chunk, embedding in zip(chunks, embeddings)
                        ]
                        total_chunks = vector_store.add_chunks(embedded_chunks)
                        indexed = total_chunks > 0
                except Exception as emb_err:
                    print(f"Warning: PDF chunk indexing skipped due to error: {emb_err}")
                    indexed = False

        preview = doc.full_text[:500] + ("..." if len(doc.full_text) > 500 else "")

        return PDFUploadResponse(
            filename=doc.filename,
            num_pages=doc.num_pages,
            total_characters=doc.total_characters,
            pages=doc.pages,
            full_text_preview=preview,
            file_path=save_path,
            total_chunks=total_chunks,
            indexed=indexed,
            status="success",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load and parse PDF document: {str(e)}",
        )
