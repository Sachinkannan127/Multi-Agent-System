import os
import sys
from unittest.mock import patch

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def test_list_tools(client):
    """Test GET /agent/tools returns registered LangChain tools including ScrapeGraphAI Realtime."""
    response = client.get("/agent/tools")
    assert response.status_code == 200
    tools = response.json()
    assert isinstance(tools, list)
    tool_names = [t["name"] for t in tools]
    assert "tavily_search_tool" in tool_names
    assert "scrapegraph_realtime_scraper" in tool_names
    assert "scrapegraph_web_scraper" in tool_names
    assert "scrapegraph_web_search" in tool_names
    assert "vector_store_search" in tool_names


@patch("app.ai.agent.LangChainToolAgent.run")
def test_agent_chat_route(mock_agent_run, client):
    """Test POST /agent/chat agent endpoint."""
    mock_agent_run.return_value = {
        "status": "success",
        "final_response": "Here are the top news headlines extracted.",
        "tool_calls_executed": [
            {
                "tool": "tavily_search_tool",
                "args": {"query": "latest AI news", "max_results": 3},
                "result": {"status": "success", "results": [{"title": "AI Breakthrough"}]}
            }
        ],
        "total_iterations": 2,
    }

    payload = {
        "prompt": "Search latest AI news using Tavily",
        "provider": "gemini"
    }
    response = client.post("/agent/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "extracted" in data["final_response"]
    assert len(data["tool_calls_executed"]) == 1
    assert data["tool_calls_executed"][0]["tool"] == "tavily_search_tool"


@patch("app.routes.agent.scrapegraph_web_scraper")
def test_direct_scrape_route(mock_scraper, client):
    """Test POST /agent/scrape direct ScrapeGraphAI tool route."""
    mock_scraper.invoke.return_value = {
        "source": "smart_scraper_graph",
        "url": "https://example.com",
        "result": {"title": "Example Domain"},
        "status": "success"
    }

    payload = {
        "url": "https://example.com",
        "prompt": "Extract title"
    }
    response = client.post("/agent/scrape", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["url"] == "https://example.com"


@patch("app.routes.agent.scrapegraph_realtime_scraper")
def test_direct_realtime_scrape_route(mock_realtime_scraper, client):
    """Test POST /agent/realtime-scrape direct real-time web scraping route."""
    mock_realtime_scraper.invoke.return_value = {
        "source": "smart_scraper_multi_graph_realtime",
        "urls": ["https://news.ycombinator.com"],
        "result": [{"title": "Live Story 1"}],
        "status": "success"
    }

    payload = {
        "urls": ["https://news.ycombinator.com"],
        "prompt": "Extract live stories"
    }
    response = client.post("/agent/realtime-scrape", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "news.ycombinator.com" in data["urls"][0]


@patch("app.routes.agent.tavily_search_tool")
def test_direct_tavily_search_route(mock_tavily, client):
    """Test POST /agent/tavily-search direct Tavily Search tool route."""
    mock_tavily.invoke.return_value = {
        "status": "success",
        "query": "artificial intelligence",
        "results": [{"title": "AI Overview", "url": "https://example.com"}],
    }

    payload = {
        "query": "artificial intelligence",
        "max_results": 3
    }
    response = client.post("/agent/tavily-search", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["query"] == "artificial intelligence"
    assert len(data["results"]) == 1
