import math
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.rag.embedder import EmbeddedChunk


class SearchResult(BaseModel):
    chunk_id: str
    score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two vector lists."""
    if len(v1) != len(v2) or not v1:
        return 0.0

    dot_product = sum(a * b for a, b in zip(v1, v2))
    norm_v1 = math.sqrt(sum(a * a for a in v1))
    norm_v2 = math.sqrt(sum(b * b for b in v2))

    if norm_v1 == 0.0 or norm_v2 == 0.0:
        return 0.0

    return dot_product / (norm_v1 * norm_v2)


class VectorStore:
    """
    RAG Stage 3: In-Memory Vector Store
    Stores chunk embeddings and performs Cosine Similarity vector search.
    """

    def __init__(self):
        self._store: Dict[str, EmbeddedChunk] = {}

    def add_chunks(self, chunks: List[EmbeddedChunk]) -> int:
        """
        Adds embedded chunks to the vector store index.
        """
        added_count = 0
        for chunk in chunks:
            self._store[chunk.chunk_id] = chunk
            added_count += 1
        return added_count

    def similarity_search(self, query_embedding: List[float], top_k: int = 3) -> List[SearchResult]:
        """
        Performs vector similarity search given a query embedding vector.
        Returns top_k most similar chunks sorted by cosine similarity score descending.
        """
        if not self._store or not query_embedding:
            return []

        scored_results: List[SearchResult] = []
        for chunk_id, chunk in self._store.items():
            score = cosine_similarity(query_embedding, chunk.embedding)
            scored_results.append(
                SearchResult(
                    chunk_id=chunk.chunk_id,
                    score=round(score, 4),
                    text=chunk.text,
                    metadata=chunk.metadata,
                )
            )

        # Sort by similarity score descending
        scored_results.sort(key=lambda x: x.score, reverse=True)
        return scored_results[:top_k]

    def clear(self):
        """Clears stored vectors."""
        self._store.clear()

    def count(self) -> int:
        """Returns total stored vector count."""
        return len(self._store)

    def get_all_chunks(self) -> List[EmbeddedChunk]:
        """Returns list of all stored embedded chunks."""
        return list(self._store.values())


# Global vector store instance for the application
vector_store = VectorStore()
