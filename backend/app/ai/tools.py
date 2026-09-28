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
def tavily_search_tool(query: str, max_results: int = 4) -> Dict[str, Any]:
    """
    PRIMARY and FASTEST tool for all web searches, weather forecasts, latest news, live facts, stock prices, and general internet queries.
    Always prefer this tool for any real-time questions, weather inquiries, or fresh online data.
    """
    logger.info(f"Executing Tavily Search for query: {query}")
    print(f"[Tool: tavily_search_tool] Ultra-fast Search: '{query}' (max_results={max_results})")

    api_key = settings.TAVILY_API_KEY
    if not api_key:
        return {
            "status": "error",
            "query": query,
            "message": "TAVILY_API_KEY is not set in environment variables."
        }

    try:
        import httpx
        resp = httpx.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "max_results": max_results,
                "search_depth": "basic",
                "include_answer": True,
            },
            timeout=8.0
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "status": "success",
                "query": query,
                "answer": data.get("answer", ""),
                "results": data.get("results", []),
                "raw_response": data
            }
        else:
            logger.warning(f"Tavily REST returned {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.warning(f"Tavily HTTP search failed: {e}")

    # Fallback to TavilyClient if available
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
        logger.error(f"Tavily fallback search failed: {e}")
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
            try:
                from scrapegraph_py import Client
            except ImportError:
                from scrapegraph_py.client import Client
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
                "model": "google_genai/gemini-1.5-flash",
                "model_tokens": 8192,
            }
        elif settings.GROQ_API_KEY:
            llm_config = {
                "api_key": settings.GROQ_API_KEY,
                "model": "groq/openai/gpt-oss-20b",
                "model_tokens": 8192,
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
        logger.warning(f"ScrapeGraphAI Realtime Scraping failed ({e}), attempting HTTP + LLM extraction fallback for {urls}...")
        fb_results = []
        for u in urls:
            res = _fallback_http_scrape(u, prompt)
            if res:
                fb_results.append(res)
        if fb_results:
            return {
                "source": "http_llm_extractor_realtime",
                "urls": urls,
                "result": fb_results if len(fb_results) > 1 else fb_results[0]["result"],
                "status": "success"
            }

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

    # 2. Use SmartScraperGraph with Groq / Gemini LLM config
    try:
        from scrapegraphai.graphs import SmartScraperGraph

        # Configure LLM based on available keys
        if settings.GROQ_API_KEY:
            llm_config = {
                "api_key": settings.GROQ_API_KEY,
                "model": "groq/openai/gpt-oss-20b",
                "model_tokens": 8192,
            }
        elif settings.GEMINI_API_KEY:
            llm_config = {
                "api_key": settings.GEMINI_API_KEY,
                "model": "google_genai/gemini-2.5-flash",
                "model_tokens": 8192,
            }
        else:
            return {
                "status": "error",
                "message": "No valid LLM API key (GROQ_API_KEY or GEMINI_API_KEY) found for ScrapeGraphAI."
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
        logger.warning(f"SmartScraperGraph failed ({e}), attempting HTTP + LLM extraction fallback for {url}...")
        fb_result = _fallback_http_scrape(url, prompt)
        if fb_result:
            return fb_result

        logger.error(f"Error executing SmartScraperGraph: {e}")
        return {
            "status": "error",
            "url": url,
            "message": f"Failed to scrape webpage: {str(e)}"
        }


def _fallback_http_scrape(url: str, prompt: str) -> Optional[Dict[str, Any]]:
    """
    Lightweight fallback: fetches raw HTML via httpx, cleans text, and uses LLM to extract structured answer.
    """
    try:
        import httpx
        import re
        import litellm
        from app.core.config import settings

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = httpx.get(url, headers=headers, timeout=15.0, follow_redirects=True)
        if resp.status_code >= 400:
            return None

        # Clean HTML to plain text
        html_text = resp.text
        clean_text = re.sub(r'<(script|style|noscript)[^>]*>.*?</\1>', ' ', html_text, flags=re.DOTALL | re.IGNORECASE)
        clean_text = re.sub(r'<[^>]+>', ' ', clean_text)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()[:16000]

        if not clean_text:
            return None

        candidate_models = []
        if settings.GROQ_API_KEY:
            candidate_models.append((settings.DEFAULT_MODEL, settings.GROQ_API_KEY))
            candidate_models.append(("groq/llama-3.3-70b-versatile", settings.GROQ_API_KEY))
        if settings.GEMINI_API_KEY:
            candidate_models.append(("gemini/gemini-2.5-flash", settings.GEMINI_API_KEY))
            candidate_models.append(("gemini/gemini-2.0-flash", settings.GEMINI_API_KEY))

        extraction = None
        for model_name, api_key in candidate_models:
            try:
                llm_resp = litellm.completion(
                    model=model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a web extraction AI. Extract the requested data accurately based on the provided webpage content."
                        },
                        {
                            "role": "user",
                            "content": f"URL: {url}\n\nWebpage Text Content:\n{clean_text}\n\nTask Prompt: {prompt}\n\nProvide a structured, accurate extraction of the requested information."
                        }
                    ],
                    api_key=api_key,
                    temperature=0.1
                )
                extraction = llm_resp.choices[0].message.content or ""
                if extraction:
                    break
            except Exception as model_err:
                logger.warning(f"Model {model_name} failed in fallback scraper: {model_err}")
                continue

        if extraction:
            return {
                "source": "http_llm_extractor",
                "url": url,
                "result": extraction,
                "status": "success"
            }
        return None
    except Exception as e:
        logger.warning(f"HTTP fallback scraper failed for {url}: {e}")
        return None


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
                "model": "google_genai/gemini-1.5-flash",
            }
        elif settings.GROQ_API_KEY:
            llm_config = {
                "api_key": settings.GROQ_API_KEY,
                "model": "groq/openai/gpt-oss-20b",
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
