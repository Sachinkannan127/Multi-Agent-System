import os
import sys
from unittest.mock import patch, MagicMock

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.ai.router import IntentClassification


def test_classify_document_prompt(client):
    """Test POST /router/classify routes document queries to 'rag'."""
    payload = {"prompt": "What are the skills listed in the uploaded resume PDF?"}
    response = client.post("/router/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "rag"
    assert data["confidence"] > 0.5


def test_classify_realtime_prompt(client):
    """Test POST /router/classify routes web scraping queries to 'toolcalling'."""
    payload = {"prompt": "Scrape https://news.ycombinator.com for latest AI news"}
    response = client.post("/router/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "toolcalling"


def test_classify_direct_prompt(client):
    """Test POST /router/classify routes basic questions to 'direct'."""
    payload = {"prompt": "Write a python function to add two numbers."}
    response = client.post("/router/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "direct"


@patch("app.ai.orchestrator.orchestrator.route_and_execute")
def test_router_chat_rag_execution(mock_execute, client):
    """Test POST /router/chat dispatches to RAG route."""
    mock_execute.return_value = MagicMock(
        query="What is in the document?",
        selected_route="rag",
        classification_reasoning="Document question detected.",
        confidence=0.95,
        response="The document covers candidate experience.",
        metadata={"total_chunks_retrieved": 3}
    )

    payload = {"prompt": "What is in the document?"}
    response = client.post("/router/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["selected_route"] == "rag"
    assert "candidate" in data["response"]


@patch("app.ai.orchestrator.orchestrator.route_and_execute")
def test_router_chat_toolcalling_execution(mock_execute, client):
    """Test POST /router/chat dispatches to toolcalling route."""
    mock_execute.return_value = MagicMock(
        query="Scrape techcrunch.com",
        selected_route="toolcalling",
        classification_reasoning="Web scraping requested.",
        confidence=0.95,
        response="Extracted stories from TechCrunch.",
        metadata={"tool_calls_executed": [{"tool": "scrapegraph_web_scraper"}]}
    )

    payload = {"prompt": "Scrape techcrunch.com for news"}
    response = client.post("/router/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["selected_route"] == "toolcalling"
    assert "TechCrunch" in data["response"]
