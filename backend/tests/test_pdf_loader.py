import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.rag.pdf_loader import PDFLoader, LoadedDocument


def test_pdf_loader_clean_text():
    """Test text cleaning and whitespace normalization."""
    raw = "  Hello \xa0 world  \n\n\n\n Section 1  "
    cleaned = PDFLoader.clean_text(raw)
    assert "Hello world" in cleaned
    assert "\n\n\n\n" not in cleaned


def test_pdf_loader_load_bytes(sample_pdf_bytes):
    """Test PDF loading from raw bytes."""
    doc = PDFLoader.load_bytes(sample_pdf_bytes, filename="test_sample.pdf")
    assert isinstance(doc, LoadedDocument)
    assert doc.filename == "test_sample.pdf"
    assert doc.num_pages >= 1
    assert len(doc.pages) == doc.num_pages


def test_pdf_loader_load_file():
    """Test PDF loading from file path if a PDF file exists."""
    upload_dir = os.path.join(project_root, "app", "upload")
    pdf_files = [f for f in os.listdir(upload_dir) if f.endswith(".pdf")] if os.path.exists(upload_dir) else []
    if pdf_files:
        filepath = os.path.join(upload_dir, pdf_files[0])
        doc = PDFLoader.load_file(filepath)
        assert isinstance(doc, LoadedDocument)
        assert doc.num_pages >= 1


if __name__ == "__main__":
    import pytest
    pytest.main([__file__])
