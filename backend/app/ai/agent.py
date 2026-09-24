import logging
from typing import Any, Dict, List, Optional
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from app.core.config import settings
from app.ai.tools import get_all_tools, scrapegraph_web_scraper, scrapegraph_web_search, vector_store_search

logger = logging.getLogger("app.ai.agent")

SYSTEM_PROMPT = """You are an intelligent Multi-Agent AI Assistant powered by LangChain Tool Calling.
You have access to specialized tools:
1. `tavily_search_tool`: Performs real-time web searches using Tavily Search API for factual news, events, and internet content.
2. `scrapegraph_web_scraper`: Scrapes any webpage URL and extracts targeted information using ScrapeGraphAI.
3. `scrapegraph_web_search`: Searches the web for live queries and extracts information using ScrapeGraphAI.
4. `vector_store_search`: Queries the MongoDB Vector Store to retrieve document chunks and contextual information.

Instructions:
- Decide when to call tools automatically based on the user's prompt.
- Use `tavily_search_tool` for fast, real-time web searches, news, and current events.
- Use `scrapegraph_web_scraper` if the user asks to scrape a specific website URL or extract deep web content.
- Use `scrapegraph_web_search` for graph-based web search & extraction.
- Use `vector_store_search` if the user asks about uploaded documents, resume information, or vector store content.
- Synthesize tool output into a concise, well-formatted response.
"""


def get_llm(model_provider: Optional[str] = None):
    """
    Instantiates a LangChain Chat Model with tool calling capabilities.
    Supported providers: 'gemini', 'groq', 'openai'
    """
    provider = (model_provider or "gemini").lower()

    if provider == "gemini" or (not model_provider and settings.GEMINI_API_KEY):
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.2,
        )
    elif provider == "groq" or (not model_provider and settings.GROQ_API_KEY):
        from langchain_groq import ChatGroq
        return ChatGroq(
            model_name="qwen-2.5-32b",
            groq_api_key=settings.GROQ_API_KEY,
            temperature=0.2,
        )
    else:
        # Fallback to Gemini or error
        if settings.GEMINI_API_KEY:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.GEMINI_API_KEY,
                temperature=0.2,
            )
        raise ValueError("No valid API keys found for initializing LangChain Chat Model.")


class LangChainToolAgent:
    """
    Multi-Agent assistant using LangChain tool binding and execution loop.
    Integrates ScrapeGraphAI web scraping and MongoDB vector store search.
    """

    def __init__(self, model_provider: Optional[str] = None):
        self.tools = get_all_tools()
        self.tools_map = {tool.name: tool for tool in self.tools}
        self.llm = get_llm(model_provider)
        self.llm_with_tools = self.llm.bind_tools(self.tools)

    def run(self, prompt: str, max_iterations: int = 5) -> Dict[str, Any]:
        """
        Runs the agent conversation loop with tool calling execution.
        """
        logger.info(f"Agent received prompt: '{prompt}'")
        print(f"[Agent] Processing user prompt: '{prompt}'")

        messages: List[BaseMessage] = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ]

        executed_tool_calls = []

        for iteration in range(max_iterations):
            response = self.llm_with_tools.invoke(messages)
            messages.append(response)

            # Check if LLM requested any tool calls
            if not response.tool_calls:
                # LLM finished generating final text response
                print(f"[Agent] Complete after {iteration + 1} iterations.")
                return {
                    "status": "success",
                    "final_response": response.content,
                    "tool_calls_executed": executed_tool_calls,
                    "total_iterations": iteration + 1,
                }

            # Process requested tool calls
            for tool_call in response.tool_calls:
                tool_name = tool_call.get("name")
                tool_args = tool_call.get("args", {})
                tool_call_id = tool_call.get("id")

                print(f"[Agent Iteration {iteration + 1}] Executing tool: '{tool_name}' with args: {tool_args}")
                logger.info(f"Executing tool '{tool_name}' with args: {tool_args}")

                tool_fn = self.tools_map.get(tool_name)
                if tool_fn:
                    try:
                        tool_result = tool_fn.invoke(tool_args)
                    except Exception as e:
                        tool_result = {"status": "error", "message": str(e)}
                else:
                    tool_result = {"status": "error", "message": f"Tool '{tool_name}' not found."}

                executed_tool_calls.append({
                    "tool": tool_name,
                    "args": tool_args,
                    "result": tool_result,
                })

                # Append ToolMessage back to conversation history
                messages.append(
                    ToolMessage(
                        content=str(tool_result),
                        tool_call_id=tool_call_id,
                    )
                )

        # Max iterations reached fallback
        final_content = messages[-1].content if messages else "Max iterations reached."
        return {
            "status": "partial",
            "final_response": final_content,
            "tool_calls_executed": executed_tool_calls,
            "total_iterations": max_iterations,
        }


# Singleton helper
tool_agent = LangChainToolAgent()
