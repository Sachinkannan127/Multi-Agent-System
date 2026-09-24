import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def test_landing_page(client):
    """Test GET / landing endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["status"] == "online"
    assert data["docs"] == "/docs"


def test_health_check(client):
    """Test GET /health health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "running" in data["message"]


if __name__ == "__main__":
    import pytest
    pytest.main([__file__])
