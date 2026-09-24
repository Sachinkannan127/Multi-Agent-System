import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def test_chat_endpoint_basic(client):
    """Test POST /chat endpoint with default mode."""
    payload = {
        "message": "Hello! Reply with 'OK'.",
        "mode": "Fast",
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["status"] == "success"
    assert "mode_used" in data
    assert "model_used" in data


def test_chat_endpoint_invalid_model_fallback(client):
    """Test POST /chat endpoint fallback behavior."""
    payload = {
        "message": "Test fallback",
        "mode": "Slow",
    }
    response = client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "reply" in data


def test_chat_stream_endpoint(client):
    """Test POST /chat/stream SSE streaming response."""
    payload = {
        "message": "Count from 1 to 3",
        "mode": "Fast",
    }
    response = client.post("/chat/stream", json=payload)
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    lines = [line for line in response.text.split("\n") if line.strip()]
    assert any("data: " in l for l in lines)


if __name__ == "__main__":
    import pytest
    pytest.main([__file__])
