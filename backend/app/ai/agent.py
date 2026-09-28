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

SYSTEM_PROMPT = """You are your Multi-Agent AI Assistant, developed by Sachin.

IDENTITY & CREATOR DIRECTIVE:
If asked "Who are you?", "Tell me about yourself", or "Who developed you?", YOU MUST EXPLICITLY STATE:
"I am your Multi-Agent AI Assistant, developed by Sachin."

APPLICATION CAPABILITIES TO HIGHLIGHT:
- Created & Developed By: Sachin
- Multi-Agent Orchestrator: Smart Intent Router dynamically classifying queries to Document Agent, Web Search Agent, Coding Agent, or Direct LLM.
- Real-Time Web Intelligence: Powered by Tavily Search API & ScrapeGraphAI for live web data and news.
- Document Intelligence (RAG): Hybrid Search (Semantic + BM25 + RRF) over MongoDB Vector Store for PDF QA.
- Software Engineering Agent: Dedicated code generation, debugging, and script optimization.
- Session Memory: Permanent MongoDB conversation storage with cross-chat context awareness.

YOUR TOOLS:
1. `tavily_search_tool`: PRIMARY & FASTEST tool. Performs real-time web searches for live factual news, weather, stock prices, and internet queries.
2. `scrapegraph_web_scraper`: Scrapes a specific webpage URL and extracts targeted information.
3. `scrapegraph_web_search`: Searches the web for complex queries.
4. `vector_store_search`: Queries the MongoDB Vector Store to retrieve indexed document chunks.

TOOL USAGE DIRECTIVE:
Whenever the user asks about recent, latest, current, now, today, live news, or real-time data, execute `tavily_search_tool` to retrieve live data. Execute only 1 search tool call per query.

OUTPUT FORMATTING REQUIREMENTS:
You MUST format your final response strictly into the following 3 markdown sections:

### 📌 Question Summary
(Provide a brief, 1-2 sentence summary of the user's question or request.)

### 💡 Main Content
(Provide the main detailed response, solution, code, explanation, or answer satisfying the user's prompt.)

### 📚 Sources & References
(Provide a bulleted list of tools executed, retrieved document chunks, webpage URLs, or knowledge sources relied upon. If no external tools or documents were used, state "Internal LLM Knowledge Base".)
"""


def get_llm(model_provider: Optional[str] = None):
    """
    Instantiates a LangChain Chat Model with tool calling capabilities.
    Supported providers: 'groq', 'gemini'
    """
    provider = (model_provider or "groq").lower()

    if provider == "groq" and settings.GROQ_API_KEY:
        try:
            from langchain_groq import ChatGroq
            return ChatGroq(
                model_name="openai/gpt-oss-20b",
                groq_api_key=settings.GROQ_API_KEY,
                temperature=0.2,
            )
        except Exception as e:
            logger.warning(f"Groq initialization failed: {e}. Falling back to Google Gemini...")

    if settings.GEMINI_API_KEY:
        from langchain_google_genai import ChatGoogleGenerativeAI
        try:
            return ChatGoogleGenerativeAI(
                model="gemini-3.8-flash",
                google_api_key=settings.GEMINI_API_KEY,
                temperature=1.0,
            )
        except Exception:
            return ChatGoogleGenerativeAI(
                model="gemini-3.5-flash",
                google_api_key=settings.GEMINI_API_KEY,
                temperature=1.0,
            )

    raise ValueError("No valid API key found for initializing LangChain Chat Model.")


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

    def run(
        self,
        prompt: str,
        history: Optional[List[Dict[str, Any]]] = None,
        conversation_id: Optional[str] = None,
        max_iterations: int = 5,
    ) -> Dict[str, Any]:
        """
        Runs the agent conversation loop with tool calling execution, session memory, and global cross-chat context.
        """
        logger.info(f"Agent received prompt: '{prompt}'")
        print(f"[Agent] Processing user prompt: '{prompt}' (History turns: {len(history) if history else 0})")

        from app.ai.global_memory import get_global_conversational_context
        global_memory_context = get_global_conversational_context(exclude_conv_id=conversation_id)
        full_system_prompt = SYSTEM_PROMPT + global_memory_context

        messages: List[BaseMessage] = [SystemMessage(content=full_system_prompt)]

        # Append sliced recent conversation history turns (last 4 turns max for token limit safety)
        recent_history = history[-4:] if history else []
        for msg in recent_history:
            if isinstance(msg, dict):
                role = msg.get("role", "").lower()
                content = (msg.get("content") or "").strip()
                if content:
                    # Truncate long history turn messages to max 300 chars
                    if len(content) > 300:
                        content = content[:300] + "..."
                    if role == "user":
                        messages.append(HumanMessage(content=content))
                    elif role in ["assistant", "ai"]:
                        messages.append(AIMessage(content=content))

        messages.append(HumanMessage(content=prompt))

        executed_tool_calls = []

        for iteration in range(max_iterations):
            try:
                response = self.llm_with_tools.invoke(messages)
            except Exception as invoke_err:
                logger.warning(f"Primary model execution error ({invoke_err}). Falling back to Gemini 3.8 Flash...")
                print(f"[Agent] Model invocation error: {invoke_err}. Falling back to Gemini 3.8 Flash...")
                try:
                    from langchain_google_genai import ChatGoogleGenerativeAI
                    fallback_llm = ChatGoogleGenerativeAI(
                        model="gemini-3.8-flash",
                        google_api_key=settings.GEMINI_API_KEY,
                        temperature=0.2,
                    ).bind_tools(self.tools)
                    self.llm_with_tools = fallback_llm
                    response = self.llm_with_tools.invoke(messages)
                except Exception as fallback_err:
                    logger.error(f"Fallback to Gemini also failed: {fallback_err}")
                    if executed_tool_calls:
                        return self._synthesize_chatgpt_response(prompt, executed_tool_calls, recent_history)
                    raise fallback_err

            messages.append(response)

            # Check if LLM requested any tool calls
            if not response.tool_calls:
                content_str = str(response.content or "").strip()
                if content_str and not content_str.startswith("Tool '"):
                    print(f"[Agent] Complete after {iteration + 1} iterations.")
                    return {
                        "status": "success",
                        "final_response": content_str,
                        "tool_calls_executed": executed_tool_calls,
                        "total_iterations": iteration + 1,
                    }
                elif executed_tool_calls:
                    return self._synthesize_chatgpt_response(prompt, executed_tool_calls, recent_history)

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

                # Compress tool result to prevent exceeding model token limits
                compressed_content = self._summarize_tool_result(tool_name, tool_result)

                # Append ToolMessage back to conversation history
                messages.append(
                    ToolMessage(
                        content=compressed_content,
                        tool_call_id=tool_call_id,
                    )
                )

            # Instant direct synthesis after tool execution to avoid redundant slow roundtrips
            if executed_tool_calls:
                print(f"[Agent] Tool results received. Synthesizing structured ChatGPT response instantly...")
                return self._synthesize_chatgpt_response(prompt, executed_tool_calls, recent_history)

        if executed_tool_calls:
            return self._synthesize_chatgpt_response(prompt, executed_tool_calls, recent_history)

        final_content = messages[-1].content if messages else "Completed."
        return {
            "status": "success",
            "final_response": str(final_content),
            "tool_calls_executed": executed_tool_calls,
            "total_iterations": max_iterations,
        }

    def _synthesize_chatgpt_response(
        self,
        prompt: str,
        executed_tool_calls: List[Dict[str, Any]],
        recent_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Generates a direct, clean, beautifully formatted ChatGPT-style markdown answer based on retrieved tool results.
        """
        import litellm

        tool_context_blocks = []
        sources = []
        for tc in executed_tool_calls:
            tool_name = tc.get("tool", "tool")
            res = tc.get("result", {})
            if isinstance(res, dict) and "results" in res:
                for item in res["results"][:4]:
                    title = item.get("title", "Web Result")
                    url = item.get("url", "")
                    content = item.get("content") or item.get("snippet") or ""
                    tool_context_blocks.append(f"- **{title}** ({url}): {content}")
                    if url:
                        sources.append(f"- [{title}]({url})")
            elif isinstance(res, dict) and "result" in res:
                tool_context_blocks.append(f"Result from {tool_name}: {str(res['result'])}")
            else:
                tool_context_blocks.append(f"Result from {tool_name}: {str(res)[:1000]}")

        combined_tool_data = "\n".join(tool_context_blocks) if tool_context_blocks else "No live tool data available."
        sources_text = "\n".join(sources) if sources else "- Live Web Intelligence"

        synthesis_prompt = f"""You are your Multi-Agent AI Assistant, developed by Sachin.

User Question: {prompt}

Retrieved Real-Time Information:
{combined_tool_data}

Task:
Synthesize a comprehensive, accurate, and structured ChatGPT-style response strictly using the following 3 markdown sections:

### 📌 Question Summary
(1-2 clear sentences summarizing what was asked)

### 💡 Main Content
(Detailed, direct answer with key data, numbers, weather forecasts/temperatures, bullet points, or step-by-step breakdown as applicable. Use clear formatting, emojis, and high readability.)

### 📚 Sources & References
{sources_text}
"""
        synthesis_messages = [{"role": "user", "content": synthesis_prompt}]
        candidate_models = [
            ("gemini/gemini-3.8-flash", settings.GEMINI_API_KEY),
            ("groq/openai/gpt-oss-20b", settings.GROQ_API_KEY),
            ("gemini/gemini-3.5-flash", settings.GEMINI_API_KEY),
        ]

        final_text = ""
        for model_name, api_key in candidate_models:
            if not api_key:
                continue
            try:
                temp = 1.0 if "gemini" in model_name else 0.2
                resp = litellm.completion(
                    model=model_name,
                    messages=synthesis_messages,
                    temperature=temp,
                    api_key=api_key,
                )
                final_text = resp.choices[0].message.content or ""
                if final_text:
                    break
            except Exception as e:
                logger.warning(f"Synthesis model {model_name} failed: {e}")
                continue

        if not final_text:
            final_text = f"### 📌 Question Summary\n{prompt}\n\n### 💡 Main Content\n{combined_tool_data}\n\n### 📚 Sources & References\n{sources_text}"

        return {
            "status": "success",
            "final_response": final_text,
            "tool_calls_executed": executed_tool_calls,
            "total_iterations": 1,
        }

    def _summarize_tool_result(self, tool_name: str, tool_result: Any, max_len: int = 1200) -> str:
        """Compresses tool outputs (search results / scrape data) to lightweight text summaries."""
        if isinstance(tool_result, dict):
            results = tool_result.get("results") or tool_result.get("search_results") or []
            if isinstance(results, list) and results:
                snippets = []
                for item in results[:3]:
                    if isinstance(item, dict):
                        t = str(item.get("title") or "").strip()
                        u = str(item.get("url") or "").strip()
                        raw_c = str(item.get("content") or item.get("snippet") or "").strip()
                        c = raw_c[:200]
                        snippets.append(f"• Title: {t}\n  URL: {u}\n  Snippet: {c}")
                if snippets:
                    res = f"Tool '{tool_name}' Search Results:\n" + "\n\n".join(snippets)
                    return res[:max_len]

        res_str = str(tool_result or "")
        if len(res_str) > max_len:
            return res_str[:max_len] + "... [truncated for token limit]"
        return res_str


# Singleton helper
tool_agent = LangChainToolAgent()
