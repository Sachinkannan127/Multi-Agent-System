import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def test_upload_pdf_success(client, sample_pdf_bytes):
    """Test successful PDF upload and text extraction."""
    files = {"file": ("test_doc.pdf", sample_pdf_bytes, "application/pdf")}
    response = client.post("/upload/pdf", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test_doc.pdf"
    assert data["num_pages"] >= 1
    assert data["status"] == "success"
    assert "file_path" in data


def test_upload_pdf_invalid_extension(client):
    """Test PDF upload with invalid file extension."""
    files = {"file": ("invalid_file.txt", b"Hello text file content", "text/plain")}
    response = client.post("/upload/pdf", files=files)
    assert response.status_code == 400
    data = response.json()
    assert "Invalid file format" in data["detail"]


if __name__ == "__main__":
    import pytest
    pytest.main([__file__])
