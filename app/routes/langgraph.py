from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage

from app.ai.graph import langgraph_app, memory_checkpointer

router = APIRouter(prefix="/graph", tags=["Stateful LangGraph Workflow"])


class GraphChatRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="User message or instruction for the stateful LangGraph Multi-Agent workflow",
        json_schema_extra={"example": "What skills are listed in the uploaded resume?"},
    )
    thread_id: str = Field(
        default="default_session",
        description="Stateful conversation thread ID for session memory persistence",
        json_schema_extra={"example": "session_123"},
    )


class GraphChatResponse(BaseModel):
    response: str
    thread_id: str
    route: str
    reasoning: str
    tool_calls_executed: List[Dict[str, Any]]
    messages_count: int
    status: str = "success"


@router.post("/chat", response_model=GraphChatResponse, summary="Stateful LangGraph Multi-Agent Chat")
def graph_chat(request: GraphChatRequest):
    """
    Executes the stateful LangGraph Multi-Agent workflow with memory persistence per thread_id.
    Retains context across turns in the same conversation thread.
    """
    try:
        config = {"configurable": {"thread_id": request.thread_id}}

        initial_state = {
            "messages": [HumanMessage(content=request.prompt)],
            "thread_id": request.thread_id,
            "route": "direct",
            "reasoning": "",
            "context": "",
            "tool_calls_executed": [],
            "memory_store": {},
        }

        # Run stateful workflow graph with MemorySaver checkpointer
        output_state = langgraph_app.invoke(initial_state, config=config)

        messages = output_state.get("messages", [])
        final_reply = messages[-1].content if messages else "No response generated."

        return GraphChatResponse(
            response=final_reply,
            thread_id=request.thread_id,
            route=output_state.get("route", "direct"),
            reasoning=output_state.get("reasoning", ""),
            tool_calls_executed=output_state.get("tool_calls_executed", []),
            messages_count=len(messages),
            status="success",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LangGraph execution failed: {str(e)}",
        )


@router.get("/memory/{thread_id}", summary="Get Stateful Thread Memory")
def get_thread_memory(thread_id: str):
    """
    Retrieves the persisted conversation memory & state history for a given thread_id.
    """
    try:
        config = {"configurable": {"thread_id": thread_id}}
        state_snapshot = langgraph_app.get_state(config)

        if not state_snapshot.values:
            return {
                "thread_id": thread_id,
                "status": "empty",
                "message": "No conversation memory found for this thread ID."
            }

        messages = state_snapshot.values.get("messages", [])
        formatted_messages = [
            {
                "role": getattr(msg, "type", "unknown"),
                "content": getattr(msg, "content", "")
            }
            for msg in messages
        ]

        return {
            "thread_id": thread_id,
            "route": state_snapshot.values.get("route"),
            "messages_count": len(formatted_messages),
            "history": formatted_messages,
            "tool_calls_executed": state_snapshot.values.get("tool_calls_executed", []),
            "status": "success",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch thread memory: {str(e)}",
        )
