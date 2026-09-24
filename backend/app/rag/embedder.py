import os
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
    embedding: List[float] = Field(..., description="Vector embedding values (e.g. 3072 floats)")
    metadata: dict = Field(default_factory=dict, description="Metadata associated with chunk")


class GeminiEmbedder:
    """
    RAG Stage 3: Gemini Text Embedding Engine
    Uses Google Gemini embedding models (gemini/gemini-embedding-001 or gemini/gemini-embedding-2)
    to convert text chunks into high-dimensional vector representations.
    """

    DEFAULT_EMBEDDING_MODEL = "gemini/gemini-embedding-001"

    def __init__(self, model: Optional[str] = None):
        self.model = model or self.DEFAULT_EMBEDDING_MODEL
        if settings.GEMINI_API_KEY:
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

    async def aembed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Asynchronously generates vector embeddings for a list of text strings.
        """
        if not texts:
            return []

        try:
            response = await litellm.aembedding(
                model=self.model,
                input=texts,
            )
            embeddings = [item["embedding"] for item in response.data]
            return embeddings
        except Exception as e:
            # Fallback to gemini/gemini-embedding-2 if model failed
            if self.model != "gemini/gemini-embedding-2":
                try:
                    response = await litellm.aembedding(
                        model="gemini/gemini-embedding-2",
                        input=texts,
                    )
                    return [item["embedding"] for item in response.data]
                except Exception as fallback_err:
                    raise RuntimeError(f"Gemini embedding error: {str(e)} | Fallback error: {str(fallback_err)}")
            raise RuntimeError(f"Gemini embedding error: {str(e)}")

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Synchronously generates vector embeddings for a list of text strings.
        """
        if not texts:
            return []
        response = litellm.embedding(
            model=self.model,
            input=texts,
        )
        return [item["embedding"] for item in response.data]
