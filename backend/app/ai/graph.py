import logging
from typing import Annotated, Any, Dict, List, Optional, TypedDict
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver

from app.core.config import settings
from app.ai.router import intent_router
from app.ai.agent import LangChainToolAgent
from app.rag.hybrid_search import hybrid_search_engine
import litellm

logger = logging.getLogger("app.ai.graph")


# --- State Definition ---

class MultiAgentState(TypedDict):
    """
    State dictionary for the stateful LangGraph Multi-Agent system with memory.
    """
    messages: Annotated[List[BaseMessage], add_messages]
    thread_id: str
    route: str  # "rag", "toolcalling", "direct"
    reasoning: str
    context: Optional[str]
    tool_calls_executed: List[Dict[str, Any]]
    memory_store: Dict[str, Any]


# --- Node Functions ---

def router_node(state: MultiAgentState) -> Dict[str, Any]:
    """
    Router Node: Analyzes the latest human message and classifies the route intent ('rag', 'toolcalling', 'direct').
    """
    messages = state.get("messages", [])
    latest_user_message = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage) or getattr(msg, "type", "") == "human":
            latest_user_message = msg.content
            break

    if not latest_user_message:
        latest_user_message = "Hello"

    print(f"[LangGraph Router Node] Classifying: '{latest_user_message}'")
    classification = intent_router.classify_intent(latest_user_message)

    return {
        "route": classification.intent,
        "reasoning": classification.reasoning,
    }


def rag_node(state: MultiAgentState) -> Dict[str, Any]:
    """
    RAG Node: Performs Hybrid Search (Semantic + BM25 + RRF) over vector store and prepares context.
    """
    messages = state.get("messages", [])
    latest_user_message = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage) or getattr(msg, "type", "") == "human":
            latest_user_message = msg.content
            break

    print(f"[LangGraph RAG Node] Running Hybrid Search for: '{latest_user_message}'")
    results = hybrid_search_engine.search(query=latest_user_message, top_k=3)

    if results:
        context_str = "\n\n".join(
            [f"--- Document Chunk {i+1} (RRF Score: {r.rrf_score}) ---\n{r.text}" for i, r in enumerate(results)]
        )
    else:
        context_str = "No relevant document chunks found in vector store."

    return {
        "context": context_str
    }


def tool_calling_node(state: MultiAgentState) -> Dict[str, Any]:
    """
    Tool Calling Node: Executes LangChain Tool Agent for web search (Tavily) or web scraping (ScrapeGraphAI).
    """
    messages = state.get("messages", [])
    latest_user_message = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage) or getattr(msg, "type", "") == "human":
            latest_user_message = msg.content
            break

    print(f"[LangGraph Tool Node] Executing tools for: '{latest_user_message}'")
    agent = LangChainToolAgent()
    agent_result = agent.run(latest_user_message)

    final_res = agent_result.get("final_response", "")
    tool_calls = agent_result.get("tool_calls_executed", [])

    return {
        "context": f"Tool Execution Results:\n{final_res}",
        "tool_calls_executed": tool_calls
    }


def assistant_node(state: MultiAgentState) -> Dict[str, Any]:
    """
    Assistant Node: Synthesizes final response given prompt, history, route context, and memory.
    """
    route = state.get("route", "direct")
    context = state.get("context", "")
    messages = state.get("messages", [])

    print(f"[LangGraph Assistant Node] Generating response for route: '{route}'")

    system_prompt = "You are a stateful Multi-Agent AI Assistant powered by LangGraph.\n"
    if route == "rag" and context:
        system_prompt += f"Use the following RAG document context to answer accurately:\n{context}\n"
    elif route == "toolcalling" and context:
        system_prompt += f"Use the following tool execution context to answer accurately:\n{context}\n"
    else:
        system_prompt += "Provide a helpful, friendly, and concise response.\n"

    # Build prompt payload with history
    llm_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        if isinstance(msg, HumanMessage) or getattr(msg, "type", "") == "human":
            llm_messages.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage) or getattr(msg, "type", "") == "ai":
            llm_messages.append({"role": "assistant", "content": msg.content})

    try:
        model_name = settings.DEFAULT_MODEL
        response = litellm.completion(
            model=model_name,
            messages=llm_messages,
            temperature=0.3
        )
        ai_reply = response.choices[0].message.content
    except Exception as e:
        ai_reply = f"Error generating assistant response: {str(e)}"

    return {
        "messages": [AIMessage(content=ai_reply)]
    }


def route_decision(state: MultiAgentState) -> str:
    """
    Conditional Edge Function: Chooses next node based on state['route'].
    """
    route = state.get("route", "direct")
    if route == "rag":
        return "rag_node"
    elif route == "toolcalling":
        return "tool_calling_node"
    else:
        return "assistant_node"


# --- LangGraph Construction ---

def build_langgraph_workflow():
    """
    Builds and compiles the stateful LangGraph Multi-Agent workflow with MemorySaver.
    """
    workflow = StateGraph(MultiAgentState)

    # Add Nodes
    workflow.add_node("router_node", router_node)
    workflow.add_node("rag_node", rag_node)
    workflow.add_node("tool_calling_node", tool_calling_node)
    workflow.add_node("assistant_node", assistant_node)

    # Add Edges
    workflow.add_edge(START, "router_node")

    # Conditional Routing Edges
    workflow.add_conditional_edges(
        "router_node",
        route_decision,
        {
            "rag_node": "rag_node",
            "tool_calling_node": "tool_calling_node",
            "assistant_node": "assistant_node",
        }
    )

    workflow.add_edge("rag_node", "assistant_node")
    workflow.add_edge("tool_calling_node", "assistant_node")
    workflow.add_edge("assistant_node", END)

    # In-memory checkpointer for thread-based conversation memory
    memory_checkpointer = MemorySaver()
    compiled_app = workflow.compile(checkpointer=memory_checkpointer)
    return compiled_app, memory_checkpointer


# Singleton graph instance and checkpointer
langgraph_app, memory_checkpointer = build_langgraph_workflow()
