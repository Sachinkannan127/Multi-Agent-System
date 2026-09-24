import io
import os
import sys
import pytest

# Ensure project root directory is in sys.path for direct python execution
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import pypdf
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient fixture for API testing."""
    return TestClient(app)


@pytest.fixture(scope="session")
def sample_pdf_bytes():
    """Generates sample valid PDF bytes for testing PDF loaders and upload endpoints."""
    writer = pypdf.PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


@pytest.fixture(scope="session")
def sample_long_text():
    """Returns sample text for chunker testing."""
    paragraphs = [
        f"Paragraph {i}: This is sentence one of paragraph {i}. This is sentence two of paragraph {i}. "
        f"It contains detailed information about RAG pipelines, text chunking, and LLM integrations."
        for i in range(1, 15)
    ]
    return "\n\n".join(paragraphs)
