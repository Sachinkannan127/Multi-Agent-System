import io
import re
from typing import List
from pydantic import BaseModel, Field
import pypdf


class PageContent(BaseModel):
    page_number: int = Field(..., description="1-indexed page number")
    text: str = Field(..., description="Extracted raw or cleaned page text")
    char_count: int = Field(..., description="Character count for this page")


class LoadedDocument(BaseModel):
    filename: str = Field(..., description="Original PDF file name")
    num_pages: int = Field(..., description="Total number of pages in PDF")
    total_characters: int = Field(..., description="Total character count across all pages")
    pages: List[PageContent] = Field(default_factory=list, description="Extracted text per page")
    full_text: str = Field(..., description="Combined text content of all pages")


class PDFLoader:
    """
    RAG Stage 1: PDF Document Loader
    Extracts structured text content and page-level metadata from PDF files or bytes.
    """

    @staticmethod
    def clean_text(text: str) -> str:
        """Sanitizes extracted text by normalizing whitespace and line endings."""
        if not text:
            return ""
        # Replace non-breaking spaces and excessive whitespace
        text = text.replace("\xa0", " ")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def load_bytes(cls, file_bytes: bytes, filename: str = "uploaded_document.pdf") -> LoadedDocument:
        """
        Loads PDF document from raw in-memory bytes.
        """
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages_content: List[PageContent] = []
        full_text_parts: List[str] = []
        total_chars = 0

        for i, page in enumerate(reader.pages):
            page_num = i + 1
            extracted = page.extract_text() or ""
            cleaned = cls.clean_text(extracted)
            char_count = len(cleaned)
            total_chars += char_count

            pages_content.append(
                PageContent(
                    page_number=page_num,
                    text=cleaned,
                    char_count=char_count,
                )
            )
            if cleaned:
                full_text_parts.append(f"--- Page {page_num} ---\n{cleaned}")

        combined_text = "\n\n".join(full_text_parts)

        return LoadedDocument(
            filename=filename,
            num_pages=len(reader.pages),
            total_characters=total_chars,
            pages=pages_content,
            full_text=combined_text,
        )

    @classmethod
    def load_file(cls, file_path: str) -> LoadedDocument:
        """
        Loads PDF document from local disk filepath.
        """
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        import os
        filename = os.path.basename(file_path)
        return cls.load_bytes(file_bytes, filename=filename)
