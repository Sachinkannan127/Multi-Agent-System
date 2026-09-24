import math
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.rag.embedder import GeminiEmbedder
from app.rag.vector_store import SearchResult, vector_store, cosine_similarity


class HybridSearchResult(BaseModel):
    chunk_id: str
    rrf_score: float = Field(..., description="Reciprocal Rank Fusion score")
    semantic_score: Optional[float] = Field(default=0.0, description="Semantic vector cosine similarity score")
    keyword_score: Optional[float] = Field(default=0.0, description="Keyword BM25 score")
    semantic_rank: Optional[int] = Field(default=None, description="Rank position in semantic search (1-indexed)")
    keyword_rank: Optional[int] = Field(default=None, description="Rank position in keyword search (1-indexed)")
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


def tokenize(text: str) -> List[str]:
    """Tokenizes string into lowercase alphanumeric words."""
    return re.findall(r"\w+", text.lower())


class BM25Okapi:
    """
    Implementation of BM25 (Best Matching 25) algorithm for keyword search.
    """
    def __init__(self, corpus: List[Dict[str, Any]], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus = corpus
        self.doc_len = []
        self.avgdl = 0.0
        self.doc_freqs = []
        self.idf = {}

        self._initialize()

    def _initialize(self):
        total_len = 0
        df = {}
        for doc in self.corpus:
            tokens = tokenize(doc.get("text", ""))
            self.doc_len.append(len(tokens))
            total_len += len(tokens)
            frequencies = {}
            for t in tokens:
                frequencies[t] = frequencies.get(t, 0) + 1
            self.doc_freqs.append(frequencies)
            for t in frequencies:
                df[t] = df.get(t, 0) + 1

        N = len(self.corpus)
        self.avgdl = (total_len / N) if N > 0 else 0.0

        for word, freq in df.items():
            # BM25 IDF formula with smoothing
            self.idf[word] = math.log((N - freq + 0.5) / (freq + 0.5) + 1.0)

    def get_scores(self, query: str) -> List[float]:
        query_tokens = tokenize(query)
        scores = [0.0] * len(self.corpus)

        for i, doc in enumerate(self.corpus):
            doc_len = self.doc_len[i]
            freqs = self.doc_freqs[i]
            score = 0.0

            for token in query_tokens:
                if token not in freqs:
                    continue
                idf = self.idf.get(token, 0.0)
                tf = freqs[token]
                numerator = idf * tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avgdl if self.avgdl > 0 else 1.0))
                score += numerator / denominator

            scores[i] = score

        return scores


class HybridSearchEngine:
    """
    Hybrid Search Engine combining:
    1. Semantic Search (Dense Vector Similarity)
    2. Keyword Search (BM25 Term Frequency & Inverse Document Frequency)
    3. Reciprocal Rank Fusion (RRF Re-ranking)
    """

    def __init__(self, rrf_k: int = 60):
        self.rrf_k = rrf_k
        self.embedder = GeminiEmbedder()

    def reciprocal_rank_fusion(
        self,
        semantic_results: List[SearchResult],
        keyword_results: List[Dict[str, Any]],
        top_k: int = 3,
    ) -> List[HybridSearchResult]:
        """
        Combines semantic and keyword ranked lists using Reciprocal Rank Fusion (RRF).
        Formula: RRF_Score(d) = 1/(k + rank_semantic(d)) + 1/(k + rank_keyword(d))
        """
        rrf_scores: Dict[str, float] = {}
        semantic_ranks: Dict[str, int] = {}
        keyword_ranks: Dict[str, int] = {}
        semantic_score_map: Dict[str, float] = {}
        keyword_score_map: Dict[str, float] = {}
        doc_map: Dict[str, Dict[str, Any]] = {}

        # Process Semantic Search Rankings (1-indexed)
        for rank, res in enumerate(semantic_results, start=1):
            chunk_id = res.chunk_id
            semantic_ranks[chunk_id] = rank
            semantic_score_map[chunk_id] = res.score
            doc_map[chunk_id] = {
                "text": res.text,
                "metadata": res.metadata
            }
            score = 1.0 / (self.rrf_k + rank)
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + score

        # Process Keyword Search Rankings (1-indexed)
        for rank, item in enumerate(keyword_results, start=1):
            chunk_id = item["chunk_id"]
            keyword_ranks[chunk_id] = rank
            keyword_score_map[chunk_id] = item["score"]
            if chunk_id not in doc_map:
                doc_map[chunk_id] = {
                    "text": item["text"],
                    "metadata": item.get("metadata", {})
                }
            score = 1.0 / (self.rrf_k + rank)
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + score

        # Build Hybrid Search Result List sorted by RRF score descending
        hybrid_results = []
        for chunk_id, score in rrf_scores.items():
            doc = doc_map[chunk_id]
            hybrid_results.append(
                HybridSearchResult(
                    chunk_id=chunk_id,
                    rrf_score=round(score, 6),
                    semantic_score=round(semantic_score_map.get(chunk_id, 0.0), 4),
                    keyword_score=round(keyword_score_map.get(chunk_id, 0.0), 4),
                    semantic_rank=semantic_ranks.get(chunk_id),
                    keyword_rank=keyword_ranks.get(chunk_id),
                    text=doc["text"],
                    metadata=doc["metadata"],
                )
            )

        hybrid_results.sort(key=lambda x: x.rrf_score, reverse=True)
        return hybrid_results[:top_k]

    def search(
        self,
        query: str,
        query_embedding: Optional[List[float]] = None,
        top_k: int = 3,
    ) -> List[HybridSearchResult]:
        """
        Executes Hybrid Search: Semantic Vector Search + BM25 Keyword Search + RRF Fusion.
        """
        if not query:
            return []

        # 1. Semantic Search (Dense Vector)
        if not query_embedding:
            try:
                query_embedding = self.embedder.embed_text(query)
            except Exception:
                query_embedding = []

        semantic_results: List[SearchResult] = []
        if query_embedding:
            semantic_results = vector_store.similarity_search(query_embedding, top_k=top_k * 5)

        # 2. Keyword Search (BM25) over documents
        corpus = []
        # Pull documents from vector store in-memory store or MongoDB collection
        if vector_store._collection is not None:
            try:
                cursor = vector_store._collection.find({}, {"_id": 1, "chunk_id": 1, "text": 1, "metadata": 1})
                for doc in cursor:
                    corpus.append({
                        "chunk_id": doc.get("chunk_id", str(doc.get("_id"))),
                        "text": doc.get("text", ""),
                        "metadata": doc.get("metadata", {})
                    })
            except Exception:
                pass

        if not corpus:
            for chunk_id, chunk in vector_store._in_memory_store.items():
                corpus.append({
                    "chunk_id": chunk.chunk_id,
                    "text": chunk.text,
                    "metadata": chunk.metadata
                })

        keyword_results = []
        if corpus:
            bm25 = BM25Okapi(corpus)
            bm25_scores = bm25.get_scores(query)
            scored_corpus = [
                {"chunk_id": corpus[i]["chunk_id"], "text": corpus[i]["text"], "metadata": corpus[i]["metadata"], "score": bm25_scores[i]}
                for i in range(len(corpus))
                if bm25_scores[i] > 0.0
            ]
            scored_corpus.sort(key=lambda x: x["score"], reverse=True)
            keyword_results = scored_corpus[:top_k * 5]

        # 3. Apply Reciprocal Rank Fusion (RRF)
        return self.reciprocal_rank_fusion(semantic_results, keyword_results, top_k=top_k)


# Singleton instance
hybrid_search_engine = HybridSearchEngine()
