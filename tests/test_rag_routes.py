import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def test_list_uploaded_documents(client):
    """Test GET /rag/documents endpoint."""
    response = client.get("/rag/documents")
    assert response.status_code == 200
    data = response.json()
    assert "documents" in data
    assert "total" in data
    assert isinstance(data["documents"], list)


def test_chunk_document_nonexistent_file(client):
    """Test POST /rag/chunk with a non-existent file."""
    payload = {
        "filename": "non_existent_file_9999.pdf",
        "chunk_size": 500,
        "chunk_overlap": 50,
    }
    response = client.post("/rag/chunk", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_chunk_document_success(client, sample_pdf_bytes):
    """Test POST /rag/chunk with a valid uploaded file."""
    upload_res = client.post("/upload/pdf", files={"file": ("rag_test_doc.pdf", sample_pdf_bytes, "application/pdf")})
    assert upload_res.status_code == 200

    payload = {
        "filename": "rag_test_doc.pdf",
        "chunk_size": 400,
        "chunk_overlap": 40,
    }
    chunk_res = client.post("/rag/chunk", json=payload)
    assert chunk_res.status_code == 200
    data = chunk_res.json()
    assert data["filename"] == "rag_test_doc.pdf"
    assert data["status"] == "success"
    assert "chunks" in data


def test_gemini_embed_and_search(client):
    """Test Stage 3: Gemini Embeddings (/rag/embed) and Vector Search (/rag/search)."""
    # 1. Embed uploaded resume or document
    embed_res = client.post("/rag/embed", json={"filename": "Sachinkannan_Resume.pdf", "chunk_size": 500, "chunk_overlap": 50})
    assert embed_res.status_code == 200
    embed_data = embed_res.json()
    assert embed_data["vector_dimension"] == 3072
    assert embed_data["embedding_model"] == "gemini/gemini-embedding-001"
    assert embed_data["total_vectors_in_store"] >= 1

    # 2. Vector similarity search
    search_res = client.post("/rag/search", json={"query": "What skills does Sachin have in Python and FastAPI?", "top_k": 2})
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data["results"]) == 2
    assert search_data["results"][0]["score"] > 0.0


def test_end_to_end_rag_qa(client):
    """Test Stage 4: End-to-End RAG Q&A (/rag/qa)."""
    qa_res = client.post("/rag/qa", json={"query": "Summarize Sachinkannan's professional role and skills.", "mode": "Fast", "top_k": 2})
    assert qa_res.status_code == 200
    qa_data = qa_res.json()
    assert "answer" in qa_data
    assert len(qa_data["answer"]) > 20
    assert qa_data["status"] == "success"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__])
