import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.rag.text_chunker import RecursiveCharacterTextSplitter, TextChunk


def test_text_chunker_empty_input():
    """Test chunker behavior with empty string."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    chunks = splitter.split_text("", source_name="empty.txt")
    assert chunks == []


def test_text_chunker_recursive_splitting(sample_long_text):
    """Test RecursiveCharacterTextSplitter splitting and overlap."""
    chunk_size = 400
    chunk_overlap = 40
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks = splitter.split_text(sample_long_text, source_name="sample.txt")

    assert len(chunks) > 0
    for chunk in chunks:
        assert isinstance(chunk, TextChunk)
        assert chunk.chunk_id is not None
        assert chunk.char_count <= chunk_size + 100
        assert "source" in chunk.metadata
        assert chunk.metadata["source"] == "sample.txt"


def test_text_chunker_chunk_indexing(sample_long_text):
    """Test index ordering of generated chunks."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=30)
    chunks = splitter.split_text(sample_long_text, source_name="sample.txt")

    for idx, chunk in enumerate(chunks):
        assert chunk.chunk_index == idx


if __name__ == "__main__":
    import pytest
    pytest.main([__file__])
