import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from langchain_core.tools import tool

from app.core.config import settings
from app.rag.vector_store import vector_store

logger = logging.getLogger("app.ai.tools")


# --- Input Schemas ---

class ScrapeWebpageInput(BaseModel):
    url: str = Field(..., description="The URL of the webpage to scrape and extract information from. Example: 'https://news.ycombinator.com'")
    prompt: str = Field(..., description="Specific prompt or question describing what information to extract from the webpage. Example: 'Extract top 5 news titles and points'")


class RealtimeScrapeInput(BaseModel):
    urls: List[str] = Field(..., description="List of target webpage URLs to scrape live real-time data from simultaneously. Example: ['https://news.ycombinator.com']")
    prompt: str = Field(..., description="Extraction goal or prompt describing the real-time data to extract. Example: 'Extract top stories and titles'")


class SearchWebInput(BaseModel):
    query: str = Field(..., description="Search query string to find information across the web. Example: 'latest news on artificial intelligence'")
    prompt: str = Field(..., description="Specific extraction goal or instructions for the search results. Example: 'Summarize top findings'")


class VectorSearchInput(BaseModel):
    query: str = Field(..., description="Text query to search matching document chunks from the MongoDB vector store. Example: 'What are the candidate's skills?'")
    top_k: int = Field(default=3, description="Number of top similar vector chunks to retrieve (default 3)")


class TavilySearchInput(BaseModel):
    query: str = Field(..., description="Search query string for Tavily AI Search Engine. Example: 'latest news on AI technology'")
    max_results: int = Field(default=5, ge=1, le=10, description="Maximum number of search results to return (default 5)")


# --- Tool Implementations ---

@tool("tavily_search_tool", args_schema=TavilySearchInput)
def tavily_search_tool(query: str, max_results: int = 5) -> Dict[str, Any]:
    """
    Performs web search using Tavily AI Search API to retrieve real-time search results, web pages, and news snippets.
    Use this tool for real-time web queries, news search, or factual current events lookups.
    """
    logger.info(f"Executing Tavily Search for query: {query}")
    print(f"[Tool: tavily_search_tool] Searching '{query}' (max_results={max_results})")

    api_key = settings.TAVILY_API_KEY
    if not api_key:
        return {
            "status": "error",
            "query": query,
            "message": "TAVILY_API_KEY is not set in environment variables."
        }

    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=api_key)
        response = client.search(query=query, max_results=max_results, search_depth="basic")

        return {
            "status": "success",
            "query": query,
            "results": response.get("results", []),
            "raw_response": response
        }
    except Exception as e:
        logger.error(f"Tavily Search failed: {e}")
        return {
            "status": "error",
            "query": query,
            "message": f"Tavily search execution failed: {str(e)}"
        }


@tool("scrapegraph_realtime_scraper", args_schema=RealtimeScrapeInput)
def scrapegraph_realtime_scraper(urls: List[str], prompt: str) -> Dict[str, Any]:
    """
    Performs live real-time web scraping on one or multiple URLs simultaneously using ScrapeGraphAI graphs.
    Use this tool when you need instant, real-time live data extraction from active web pages.
    """
    logger.info(f"Executing ScrapeGraphAI Realtime Scraper on {len(urls)} URLs: {urls}")
    print(f"[Tool: scrapegraph_realtime_scraper] Live scraping {urls} with prompt: '{prompt}'")

    if not urls:
        return {"status": "error", "message": "No URLs provided for real-time scraping."}

    # 1. ScrapeGraph Cloud API if SGAI_API_KEY is available
    if settings.SGAI_API_KEY:
        try:
            from scrapegraph_py import Client
            sgai_client = Client(api_key=settings.SGAI_API_KEY)
            results = []
            for u in urls:
                res = sgai_client.smartscraper(website_url=u, user_prompt=prompt)
                results.append({"url": u, "data": res})
            return {
                "source": "scrapegraph_cloud_realtime",
                "total_urls": len(urls),
                "results": results,
                "status": "success"
            }
        except Exception as e:
            logger.warning(f"ScrapeGraph Cloud API failed: {e}. Falling back to local graph.")

    # 2. Local ScrapeGraphAI Graph Execution
    try:
        if settings.GEMINI_API_KEY:
            llm_config = {
                "api_key": settings.GEMINI_API_KEY,
                "model": "google_genai/gemini-2.5-flash",
            }
        elif settings.GROQ_API_KEY:
            llm_config = {
                "api_key": settings.GROQ_API_KEY,
                "model": "groq/qwen-2.5-32b",
            }
        else:
            return {
                "status": "error",
                "message": "No valid LLM API key found for real-time ScrapeGraphAI web scraping."
            }

        graph_config = {
            "llm": llm_config,
            "verbose": False,
            "headless": True,
        }

        if len(urls) == 1:
            from scrapegraphai.graphs import SmartScraperGraph
            graph = SmartScraperGraph(prompt=prompt, source=urls[0], config=graph_config)
            result = graph.run()
            return {
                "source": "smart_scraper_graph_realtime",
                "url": urls[0],
                "result": result,
                "status": "success"
            }
        else:
            from scrapegraphai.graphs import SmartScraperMultiGraph
            graph = SmartScraperMultiGraph(prompt=prompt, source=urls, config=graph_config)
            result = graph.run()
            return {
                "source": "smart_scraper_multi_graph_realtime",
                "urls": urls,
                "result": result,
                "status": "success"
            }
    except Exception as e:
        logger.error(f"ScrapeGraphAI Realtime Scraping failed: {e}")
        return {
            "status": "error",
            "urls": urls,
            "message": f"Realtime scraping failed: {str(e)}"
        }


@tool("scrapegraph_web_scraper", args_schema=ScrapeWebpageInput)
def scrapegraph_web_scraper(url: str, prompt: str) -> Dict[str, Any]:
    """
    Scrapes a webpage URL using ScrapeGraphAI and extracts structured data based on the provided prompt.
    Use this tool when you need to extract specific content, text, data, or summary from a specific website URL.
    """
    logger.info(f"Executing ScrapeGraphAI Web Scraper on URL: {url}")
    print(f"[Tool: scrapegraph_web_scraper] Scraping '{url}' with prompt: '{prompt}'")

    # 1. Try ScrapeGraph Cloud Client if SGAI_API_KEY is available
    if settings.SGAI_API_KEY:
        try:
            from scrapegraph_py import Client
            sgai_client = Client(api_key=settings.SGAI_API_KEY)
            response = sgai_client.smartscraper(
                website_url=url,
                user_prompt=prompt
            )
            return {
                "source": "scrapegraph_cloud",
                "url": url,
                "result": response,
                "status": "success"
            }
        except Exception as e:
            logger.warning(f"ScrapeGraph Cloud API failed: {e}. Falling back to SmartScraperGraph local graph.")

    # 2. Use SmartScraperGraph with Gemini / Groq LLM config
    try:
        from scrapegraphai.graphs import SmartScraperGraph

        # Configure LLM based on available keys
        if settings.GEMINI_API_KEY:
            llm_config = {
                "api_key": settings.GEMINI_API_KEY,
                "model": "google_genai/gemini-2.5-flash",
            }
        elif settings.GROQ_API_KEY:
            llm_config = {
                "api_key": settings.GROQ_API_KEY,
                "model": "groq/qwen-2.5-32b",
            }
        else:
            return {
                "status": "error",
                "message": "No valid LLM API key (GEMINI_API_KEY or GROQ_API_KEY) found for ScrapeGraphAI."
            }

        graph_config = {
            "llm": llm_config,
            "verbose": False,
            "headless": True,
        }

        scraper_graph = SmartScraperGraph(
            prompt=prompt,
            source=url,
            config=graph_config
        )
        result = scraper_graph.run()

        return {
            "source": "smart_scraper_graph",
            "url": url,
            "result": result,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error executing SmartScraperGraph: {e}")
        return {
            "status": "error",
            "url": url,
            "message": f"Failed to scrape webpage: {str(e)}"
        }


@tool("scrapegraph_web_search", args_schema=SearchWebInput)
def scrapegraph_web_search(query: str, prompt: str) -> Dict[str, Any]:
    """
    Searches the web using ScrapeGraphAI SearchGraph and extracts structured information for the query.
    Use this tool when you need live search results or news from the internet.
    """
    logger.info(f"Executing ScrapeGraphAI Web Search for query: {query}")
    print(f"[Tool: scrapegraph_web_search] Searching '{query}' with prompt: '{prompt}'")

    try:
        from scrapegraphai.graphs import SearchGraph

        if settings.GEMINI_API_KEY:
            llm_config = {
                "api_key": settings.GEMINI_API_KEY,
                "model": "google_genai/gemini-2.5-flash",
            }
        elif settings.GROQ_API_KEY:
            llm_config = {
                "api_key": settings.GROQ_API_KEY,
                "model": "groq/qwen-2.5-32b",
            }
        else:
            return {
                "status": "error",
                "message": "No valid LLM API key found for ScrapeGraphAI search."
            }

        graph_config = {
            "llm": llm_config,
            "verbose": False,
            "headless": True,
            "max_results": 3
        }

        search_graph = SearchGraph(
            prompt=prompt,
            config=graph_config
        )
        result = search_graph.run()

        return {
            "source": "search_graph",
            "query": query,
            "result": result,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error executing SearchGraph: {e}")
        return {
            "status": "error",
            "query": query,
            "message": f"Failed web search: {str(e)}"
        }


@tool("vector_store_search", args_schema=VectorSearchInput)
def vector_store_search(query: str, top_k: int = 3) -> Dict[str, Any]:
    """
    Searches document vectors in the MongoDB vector store for relevant context.
    Use this tool to find information from uploaded PDF documents, resumes, or knowledge bases.
    """
    print(f"[Tool: vector_store_search] Querying vector store for '{query}' (top_k={top_k})")
    try:
        from app.rag.embedder import GeminiEmbedder
        embedder = GeminiEmbedder()
        query_vector = embedder.embed_text(query)
        results = vector_store.similarity_search(query_vector, top_k=top_k)

        formatted_results = [
            {
                "chunk_id": r.chunk_id,
                "score": r.score,
                "text": r.text,
                "metadata": r.metadata
            }
            for r in results
        ]

        return {
            "status": "success",
            "query": query,
            "total_results": len(formatted_results),
            "results": formatted_results
        }
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return {
            "status": "error",
            "query": query,
            "message": f"Vector store search failed: {str(e)}"
        }


def get_all_tools() -> List[Any]:
    """Returns all available LangChain tools."""
    return [
        tavily_search_tool,
        scrapegraph_realtime_scraper,
        scrapegraph_web_scraper,
        scrapegraph_web_search,
        vector_store_search,
    ]
