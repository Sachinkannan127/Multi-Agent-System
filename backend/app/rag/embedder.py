import os
import asyncio
import numpy as np
from typing import List, Optional
from pydantic import BaseModel, Field
import litellm
from app.core.config import settings

# Suppress litellm debug info
litellm.suppress_debug_info = True
litellm.drop_params = True


class EmbeddedChunk(BaseModel):
    chunk_id: str = Field(..., description="Unique chunk ID")
    text: str = Field(..., description="Text content of the chunk")
    embedding: List[float] = Field(..., description="Vector embedding values")
    metadata: dict = Field(default_factory=dict, description="Metadata associated with chunk")


class GeminiEmbedder:
    """
    RAG Stage 3: Gemini Text Embedding Engine
    Uses Google Gemini embedding models (gemini/gemini-embedding-001)
    to convert text chunks into vector representations.
    Executes in small batches of max 25 items with rate-limit retry & fallback.
    """

    DEFAULT_EMBEDDING_MODEL = "gemini/gemini-embedding-001"

    def __init__(self, model: Optional[str] = None):
        self.model = model or self.DEFAULT_EMBEDDING_MODEL
        if settings.GEMINI_API_KEY:
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    def _hash_fallback_embedding(self, text: str, dim: int = 768) -> List[float]:
        """Generates a normalized pseudo-embedding vector when API limit is reached."""
        vec = [0.0] * dim
        for word in text.split():
            h = abs(hash(word)) % dim
            vec[h] += 1.0
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = (np.array(vec) / norm).tolist()
        return vec

    async def aembed_texts(self, texts: List[str], batch_size: int = 25) -> List[List[float]]:
        """
        Asynchronously generates vector embeddings for a list of text strings in safe batches.
        """
        if not texts:
            return []

        all_embeddings: List[List[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = None

            for attempt in range(3):
                try:
                    response = await litellm.aembedding(
                        model=self.model,
                        input=batch,
                    )
                    batch_embeddings = [item["embedding"] for item in response.data]
                    break
                except Exception as e:
                    err_str = str(e).lower()
                    if ("429" in err_str or "quota" in err_str or "rate" in err_str or "resource_exhausted" in err_str) and attempt < 2:
                        await asyncio.sleep(2.0 * (attempt + 1))
                        continue
                    else:
                        print(f"Warning: Gemini embedding batch failed: {e}")
                        break

            if not batch_embeddings:
                print(f"Using fallback hash embeddings for batch of {len(batch)} chunks.")
                batch_embeddings = [self._hash_fallback_embedding(t) for t in batch]

            all_embeddings.extend(batch_embeddings)
            if i + batch_size < len(texts):
                await asyncio.sleep(0.4)

        return all_embeddings

    def embed_texts(self, texts: List[str], batch_size: int = 25) -> List[List[float]]:
        """
        Synchronously generates vector embeddings for a list of text strings in safe batches.
        """
        if not texts:
            return []

        all_embeddings: List[List[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                response = litellm.embedding(
                    model=self.model,
                    input=batch,
                )
                embeddings = [item["embedding"] for item in response.data]
                all_embeddings.extend(embeddings)
            except Exception as e:
                print(f"Sync embedding batch failed: {e}. Using fallback.")
                fallback = [self._hash_fallback_embedding(t) for t in batch]
                all_embeddings.extend(fallback)
        return all_embeddings

    def embed_text(self, text: str) -> List[float]:
        """
        Generates vector embedding for a single query string.
        """
        res = self.embed_texts([text])
        return res[0] if res else []

