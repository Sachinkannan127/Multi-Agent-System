import os
import sys
from unittest.mock import patch, MagicMock

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.rag.hybrid_search import BM25Okapi, HybridSearchEngine, HybridSearchResult
from app.rag.vector_store import SearchResult


def test_bm25_scoring():
    """Test BM25 keyword scoring algorithm."""
    corpus = [
        {"chunk_id": "c1", "text": "Python is a popular programming language for AI and machine learning."},
        {"chunk_id": "c2", "text": "Java is an object-oriented language for enterprise applications."},
        {"chunk_id": "c3", "text": "Machine learning and artificial intelligence use Python code."}
    ]
    bm25 = BM25Okapi(corpus)
    scores = bm25.get_scores("Python AI")
    assert len(scores) == 3
    assert scores[0] > 0.0
    assert scores[2] > 0.0
    assert scores[0] > scores[1]  # Python AI match should rank higher than Java


def test_rrf_re_ranking():
    """Test Reciprocal Rank Fusion algorithm combining semantic and keyword lists."""
    engine = HybridSearchEngine(rrf_k=60)

    semantic_list = [
        SearchResult(chunk_id="c1", score=0.95, text="Doc 1 text"),
        SearchResult(chunk_id="c2", score=0.80, text="Doc 2 text"),
    ]
    keyword_list = [
        {"chunk_id": "c2", "text": "Doc 2 text", "score": 4.5},
        {"chunk_id": "c1", "text": "Doc 1 text", "score": 2.1},
    ]

    results = engine.reciprocal_rank_fusion(semantic_list, keyword_list, top_k=2)
    assert len(results) == 2
    assert isinstance(results[0], HybridSearchResult)
    assert results[0].rrf_score > 0.0
    # Both c1 and c2 should have semantic_rank and keyword_rank recorded
    assert results[0].semantic_rank is not None
    assert results[0].keyword_rank is not None


def test_hybrid_search_route(client):
    """Test POST /rag/hybrid-search endpoint."""
    with patch("app.rag.hybrid_search.HybridSearchEngine.search") as mock_search:
        mock_search.return_value = [
            HybridSearchResult(
                chunk_id="c1",
                rrf_score=0.032,
                semantic_score=0.91,
                keyword_score=3.2,
                semantic_rank=1,
                keyword_rank=1,
                text="Python experience with FastAPI and MongoDB.",
                metadata={"filename": "resume.pdf"}
            )
        ]

        payload = {"query": "Python FastAPI", "top_k": 3}
        response = client.post("/rag/hybrid-search", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["search_mode"] == "hybrid_semantic_bm25_rrf"
        assert len(data["results"]) == 1
        assert data["results"][0]["chunk_id"] == "c1"
