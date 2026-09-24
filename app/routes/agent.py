from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.ai.agent import LangChainToolAgent, tool_agent
from app.ai.tools import get_all_tools, scrapegraph_web_scraper, scrapegraph_realtime_scraper, tavily_search_tool

router = APIRouter(prefix="/agent", tags=["LangChain Tool Agent"])


class AgentChatRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="User query or instruction for the AI agent",
        json_schema_extra={"example": "Scrape https://news.ycombinator.com and give me the top 3 tech stories."},
    )
    provider: Optional[str] = Field(
        default="gemini",
        description="LLM provider for tool calling: 'gemini' or 'groq'",
        json_schema_extra={"example": "gemini"},
    )


class ScrapeRequest(BaseModel):
    url: str = Field(
        ...,
        description="Webpage URL to scrape with ScrapeGraphAI",
        json_schema_extra={"example": "https://news.ycombinator.com"},
    )
    prompt: str = Field(
        ...,
        description="Extraction target or instruction",
        json_schema_extra={"example": "Extract the top headlines and submitter names"},
    )


class RealtimeScrapeRequest(BaseModel):
    urls: List[str] = Field(
        ...,
        description="List of target webpage URLs for live real-time data scraping",
        json_schema_extra={"example": ["https://news.ycombinator.com"]},
    )
    prompt: str = Field(
        ...,
        description="Extraction prompt describing the real-time data to extract",
        json_schema_extra={"example": "Extract real-time top stories, points, and authors"},
    )


class TavilySearchRequest(BaseModel):
    query: str = Field(
        ...,
        description="Web search query string",
        json_schema_extra={"example": "latest updates in artificial intelligence"},
    )
    max_results: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Number of top search results to return",
        json_schema_extra={"example": 5},
    )


class AgentChatResponse(BaseModel):
    status: str
    final_response: str
    tool_calls_executed: List[Dict[str, Any]]
    total_iterations: int


@router.post("/chat", response_model=AgentChatResponse, summary="Chat with LangChain Tool Calling Agent")
def agent_chat(request: AgentChatRequest):
    """
    Executes the LangChain Tool Calling Agent on a user prompt.
    The agent autonomously decides when to trigger Tavily Search, ScrapeGraphAI real-time scraping, or vector store search tools.
    """
    try:
        agent = LangChainToolAgent(model_provider=request.provider)
        result = agent.run(request.prompt)
        return AgentChatResponse(
            status=result["status"],
            final_response=result["final_response"],
            tool_calls_executed=result["tool_calls_executed"],
            total_iterations=result["total_iterations"],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent execution failed: {str(e)}",
        )


@router.post("/scrape", summary="Direct ScrapeGraphAI Tool Execution")
def direct_scrape(request: ScrapeRequest):
    """
    Directly triggers the ScrapeGraphAI web scraping tool on a URL with a target prompt.
    """
    try:
        res = scrapegraph_web_scraper.invoke({"url": request.url, "prompt": request.prompt})
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ScrapeGraphAI tool failed: {str(e)}",
        )


@router.post("/realtime-scrape", summary="Direct ScrapeGraphAI Realtime Web Scraping")
def direct_realtime_scrape(request: RealtimeScrapeRequest):
    """
    Directly triggers ScrapeGraphAI real-time web scraping over single or multiple URLs simultaneously.
    """
    try:
        res = scrapegraph_realtime_scraper.invoke({"urls": request.urls, "prompt": request.prompt})
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Real-time web scraping failed: {str(e)}",
        )


@router.post("/tavily-search", summary="Direct Tavily Search Tool Execution")
def direct_tavily_search(request: TavilySearchRequest):
    """
    Directly triggers the Tavily Search tool for real-time web search.
    """
    try:
        res = tavily_search_tool.invoke({"query": request.query, "max_results": request.max_results})
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tavily search failed: {str(e)}",
        )


@router.get("/tools", summary="List Available LangChain Tools")
def list_tools():
    """
    Lists all available LangChain tools registered in the agent system.
    """
    tools = get_all_tools()
    return [
        {
            "name": tool.name,
            "description": tool.description,
            "args_schema": tool.args_schema.model_json_schema() if tool.args_schema else None,
        }
        for tool in tools
    ]
