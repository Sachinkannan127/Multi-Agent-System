import math
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import pymongo
from app.core.config import settings
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


class MongoDBVectorStore:
    """
    RAG Stage 3: MongoDB Vector Store
    Stores vector embeddings in MongoDB database collections and performs
    MongoDB Atlas Vector Search ($vectorSearch) or Cosine Similarity vector matching.
    """

    def __init__(
        self,
        uri: Optional[str] = None,
        db_name: Optional[str] = None,
        collection_name: Optional[str] = None,
        vector_index_name: Optional[str] = None,
    ):
        self.uri = uri or settings.MONGODB_URI
        self.db_name = db_name or settings.MONGODB_DB_NAME
        self.collection_name = collection_name or settings.MONGODB_COLLECTION_NAME
        self.vector_index_name = vector_index_name or settings.VECTOR_INDEX_NAME

        self._in_memory_store: Dict[str, EmbeddedChunk] = {}
        self._mongo_client: Optional[pymongo.MongoClient] = None
        self._collection = None

        if self.uri:
            try:
                print("Connecting to MongoDB...")
                self._mongo_client = pymongo.MongoClient(self.uri, serverSelectionTimeoutMS=3000)
                db = self._mongo_client[self.db_name]
                self._collection = db[self.collection_name]
                # Test connectivity
                ping_res = self._mongo_client.admin.command("ping")
                print(f"MongoDB connected successfully! Ping status: {ping_res}")
            except Exception as e:
                # MongoDB connection failed or offline; use in-memory fallback
                print(f"MongoDB connection failed: {e}. Falling back to in-memory store.")
                self._collection = None

    def add_chunks(self, chunks: List[EmbeddedChunk]) -> int:
        """
        Stores embedded chunks in MongoDB collection (and in-memory cache).
        """
        for chunk in chunks:
            self._in_memory_store[chunk.chunk_id] = chunk

        if self._collection is not None:
            bulk_ops = []
            for chunk in chunks:
                doc = {
                    "_id": chunk.chunk_id,
                    "chunk_id": chunk.chunk_id,
                    "text": chunk.text,
                    "embedding": chunk.embedding,
                    "metadata": chunk.metadata,
                }
                bulk_ops.append(
                    pymongo.ReplaceOne({"_id": chunk.chunk_id}, doc, upsert=True)
                )

            if bulk_ops:
                self._collection.bulk_write(bulk_ops)

        return len(chunks)

    def similarity_search(self, query_embedding: List[float], top_k: int = 3, user_id: Optional[str] = None) -> List[SearchResult]:
        """
        Performs Vector Similarity Search over MongoDB collection.
        Supports MongoDB Atlas $vectorSearch pipeline stage if available,
        scoped to a specific user_id if provided.
        """
        if not query_embedding:
            return []

        # 1. Try MongoDB Atlas Vector Search pipeline if connected
        if self._collection is not None:
            try:
                search_stage = {
                    "index": self.vector_index_name,
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": top_k * 10,
                    "limit": top_k if not user_id else top_k * 5,
                }
                if user_id:
                    search_stage["filter"] = {"metadata.user_id": {"$eq": user_id}}

                pipeline = [
                    {"$vectorSearch": search_stage},
                    {
                        "$project": {
                            "_id": 1,
                            "chunk_id": 1,
                            "text": 1,
                            "metadata": 1,
                            "score": {"$meta": "vectorSearchScore"},
                        }
                    },
                ]
                cursor = self._collection.aggregate(pipeline)
                results = []
                for doc in cursor:
                    meta = doc.get("metadata", {})
                    if user_id and meta.get("user_id") != user_id:
                        continue
                    results.append(
                        SearchResult(
                            chunk_id=doc.get("chunk_id", str(doc.get("_id"))),
                            score=round(float(doc.get("score", 0.0)), 4),
                            text=doc.get("text", ""),
                            metadata=meta,
                        )
                    )
                if results:
                    return results[:top_k]
            except Exception:
                pass

            # 2. MongoDB Cosine Matching over collection documents
            try:
                find_filter = {"metadata.user_id": user_id} if user_id else {}
                cursor = self._collection.find(find_filter, {"_id": 1, "chunk_id": 1, "text": 1, "embedding": 1, "metadata": 1})
                scored_results = []
                for doc in cursor:
                    vec = doc.get("embedding", [])
                    if vec:
                        score = cosine_similarity(query_embedding, vec)
                        scored_results.append(
                            SearchResult(
                                chunk_id=doc.get("chunk_id", str(doc.get("_id"))),
                                score=round(score, 4),
                                text=doc.get("text", ""),
                                metadata=doc.get("metadata", {}),
                            )
                        )
                scored_results.sort(key=lambda x: x.score, reverse=True)
                if scored_results:
                    return scored_results[:top_k]
            except Exception:
                pass

        # 3. Fallback to in-memory store similarity search
        scored_results = []
        for chunk_id, chunk in self._in_memory_store.items():
            if user_id and chunk.metadata.get("user_id") != user_id:
                continue
            score = cosine_similarity(query_embedding, chunk.embedding)
            scored_results.append(
                SearchResult(
                    chunk_id=chunk.chunk_id,
                    score=round(score, 4),
                    text=chunk.text,
                    metadata=chunk.metadata,
                )
            )
        scored_results.sort(key=lambda x: x.score, reverse=True)
        return scored_results[:top_k]

    def count(self, user_id: Optional[str] = None) -> int:
        """Returns total vector count, optionally filtered by user_id."""
        if self._collection is not None:
            try:
                filter_q = {"metadata.user_id": user_id} if user_id else {}
                return self._collection.count_documents(filter_q)
            except Exception:
                pass
        if user_id:
            return sum(1 for c in self._in_memory_store.values() if c.metadata.get("user_id") == user_id)
        return len(self._in_memory_store)

    def remove_source(self, filename: str) -> None:
        """Remove previously indexed chunks belonging to one uploaded document."""
        stale_ids = [
            chunk_id for chunk_id, chunk in self._in_memory_store.items()
            if chunk.metadata.get("filename") == filename
        ]
        for chunk_id in stale_ids:
            del self._in_memory_store[chunk_id]

        if self._collection is not None:
            try:
                self._collection.delete_many({"metadata.filename": filename})
            except Exception:
                pass

    def remove_user_chunks(self, user_id: str) -> None:
        """Remove previously indexed chunks belonging to a specific user."""
        if not user_id:
            return
        stale_ids = [
            chunk_id for chunk_id, chunk in self._in_memory_store.items()
            if chunk.metadata.get("user_id") == user_id
        ]
        for chunk_id in stale_ids:
            del self._in_memory_store[chunk_id]

        if self._collection is not None:
            try:
                self._collection.delete_many({"metadata.user_id": user_id})
            except Exception:
                pass

    def clear(self):
        """Clears vectors from store and MongoDB collection."""
        self._in_memory_store.clear()
        if self._collection is not None:
            try:
                self._collection.delete_many({})
            except Exception:
                pass


# Aliases & singleton instance
VectorStore = MongoDBVectorStore
vector_store = MongoDBVectorStore()
