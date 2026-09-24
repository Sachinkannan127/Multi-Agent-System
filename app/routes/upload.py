import os
from typing import List, Optional
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from app.rag.pdf_loader import PDFLoader, PageContent

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

        preview = doc.full_text[:500] + ("..." if len(doc.full_text) > 500 else "")

        return PDFUploadResponse(
            filename=doc.filename,
            num_pages=doc.num_pages,
            total_characters=doc.total_characters,
            pages=doc.pages,
            full_text_preview=preview,
            file_path=save_path,
            status="success",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load and parse PDF document: {str(e)}",
        )
