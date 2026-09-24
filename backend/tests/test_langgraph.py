import os
import sys
from unittest.mock import patch, MagicMock

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.ai.graph import build_langgraph_workflow, langgraph_app


def test_build_workflow():
    """Test LangGraph StateGraph construction and checkpointer compilation."""
    app, checkpointer = build_langgraph_workflow()
    assert app is not None
    assert checkpointer is not None


@patch("app.ai.graph.litellm.completion")
def test_graph_chat_stateful_memory(mock_litellm, client):
    """Test stateful LangGraph multi-agent chat and thread memory persistence."""
    mock_choice = MagicMock()
    mock_choice.message.content = "I am your stateful AI Assistant."
    mock_litellm.return_value = MagicMock(choices=[mock_choice])

    thread_id = "test_session_123"

    # Turn 1: First user message
    payload_1 = {
        "prompt": "Hello! My name is Sachin.",
        "thread_id": thread_id
    }
    response_1 = client.post("/graph/chat", json=payload_1)
    assert response_1.status_code == 200
    data_1 = response_1.json()
    assert data_1["status"] == "success"
    assert data_1["thread_id"] == thread_id
    assert data_1["messages_count"] >= 2

    # Turn 2: Verify thread memory lookup
    response_mem = client.get(f"/graph/memory/{thread_id}")
    assert response_mem.status_code == 200
    data_mem = response_mem.json()
    assert data_mem["status"] == "success"
    assert data_mem["thread_id"] == thread_id
    assert data_mem["messages_count"] >= 2
