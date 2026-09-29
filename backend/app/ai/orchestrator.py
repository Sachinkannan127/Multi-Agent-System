import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import litellm

from app.core.config import settings
from app.ai.router import IntentClassification, SmartIntentRouter, intent_router
from app.ai.agent import LangChainToolAgent, tool_agent
from app.rag.embedder import GeminiEmbedder
from app.rag.vector_store import vector_store

logger = logging.getLogger("app.ai.orchestrator")


class RouterExecutionResult(BaseModel):
    query: str
    selected_route: str = Field(..., description="Selected route: 'rag', 'toolcalling', or 'direct'")
    classification_reasoning: str
    confidence: float
    response: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SmartMultiAgentOrchestrator:
    """
    Orchestrates execution by dynamically routing prompts to:
    1. RAG Pipeline (Document / PDF Vector Store QA)
    2. Tool Calling Agent (Tavily Search / ScrapeGraphAI Web Scraping)
    3. Direct LLM (General Knowledge / Basic Chat)
    """

    def __init__(self, router: Optional[SmartIntentRouter] = None):
        self.router = router or intent_router

    def route_and_execute(
        self,
        prompt: str,
        provider: Optional[str] = None,
        top_k_rag: int = 3,
        history: Optional[List[Dict[str, Any]]] = None,
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> RouterExecutionResult:
        """
        Main entry point: classifies prompt and dispatches to the corresponding pipeline with history memory and global context.
        """
        logger.info(f"Orchestrator evaluating prompt: '{prompt}'")
        print(f"[Orchestrator] Classifying prompt: '{prompt}' (History turns: {len(history) if history else 0})")

        # 1. Classify Intent
        classification: IntentClassification = self.router.classify_intent(prompt)
        route = classification.intent
        print(f"[Orchestrator] Route selected: '{route.upper()}' (Confidence: {classification.confidence}) - {classification.reasoning}")

        # 2. Dispatch to Selected Pipeline

        # Route A: RAG (Document / PDF Vector Store QA Agent)
        if route == "rag":
            return self._execute_rag_pipeline(prompt, classification, top_k=top_k_rag, history=history, conversation_id=conversation_id, user_id=user_id)

        # Route B: Web Search Agent (Tavily Search / ScrapeGraphAI Scraping)
        elif route == "toolcalling":
            return self._execute_toolcalling_pipeline(prompt, classification, provider=provider, history=history, conversation_id=conversation_id, user_id=user_id)

        # Route C: Specialized Coding Agent (Software Engineering / Script Generation)
        elif route == "coding":
            return self._execute_coding_pipeline(prompt, classification, provider=provider, history=history, conversation_id=conversation_id, user_id=user_id)

        # Route D: Direct LLM Completion
        else:
            return self._execute_direct_pipeline(prompt, classification, provider=provider, history=history, conversation_id=conversation_id, user_id=user_id)

    def _execute_rag_pipeline(
        self,
        prompt: str,
        classification: IntentClassification,
        top_k: int = 3,
        history: Optional[List[Dict[str, Any]]] = None,
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> RouterExecutionResult:
        """Executes Hybrid Search (Semantic + BM25 + RRF) + LLM synthesis."""
        print(f"[RAG Route] Executing Hybrid Search (Semantic + BM25 + RRF) for context...")
        try:
            from app.rag.hybrid_search import hybrid_search_engine
            from app.ai.global_memory import get_global_conversational_context

            search_results = hybrid_search_engine.search(query=prompt, top_k=top_k, user_id=user_id)
            global_mem = get_global_conversational_context(user_id=user_id, exclude_conv_id=conversation_id)

            context_str = "\n\n".join(
                [f"--- Document Chunk {i+1} (RRF Score: {r.rrf_score}) ---\n{r.text}" for i, r in enumerate(search_results)]
            ) if search_results else "No relevant document chunks found in vector store."

            system_instruction = (
                "You are your Multi-Agent AI Assistant, developed by Sachin.\n\n"
                "IDENTITY & CREATOR DIRECTIVE:\n"
                "If asked 'Who are you?', 'Tell me about yourself', or 'Who developed you?', YOU MUST EXPLICITLY STATE:\n"
                "'I am your Multi-Agent AI Assistant, developed by Sachin.'\n\n"
                "APPLICATION CAPABILITIES TO HIGHLIGHT:\n"
                "- Created & Developed By: Sachin\n"
                "- Multi-Agent Orchestrator: Smart Intent Router dynamically classifying queries to Document Agent, Web Search Agent, Coding Agent, or Direct LLM.\n"
                "- Real-Time Web Intelligence: Powered by Tavily Search API & ScrapeGraphAI for live web data and news.\n"
                "- Document Intelligence (RAG): Hybrid Search (Semantic + BM25 + RRF) over MongoDB Vector Store for PDF QA.\n"
                "- Software Engineering Agent: Dedicated code generation, debugging, and script optimization.\n"
                "- Session Memory: Permanent MongoDB conversation storage with cross-chat context awareness.\n\n"
                "OUTPUT FORMATTING REQUIREMENTS:\n"
                "You MUST format your final response strictly into the following 3 markdown sections:\n\n"
                "### 📌 Question Summary\n"
                "(Brief 1-2 sentence summary of the user's question or request.)\n\n"
                "### 💡 Main Content\n"
                "(Main detailed answer satisfying the user request based on the provided document context.)\n\n"
                "### 📚 Sources & References\n"
                "(Bulleted list of document chunks, files, or RRF scores relied upon.)\n\n"
                f"DOCUMENT CONTEXT:\n{context_str}\n"
                f"{global_mem}"
            )

            messages = [{"role": "system", "content": system_instruction}]
            if history:
                for item in history[-4:]:
                    if isinstance(item, dict) and item.get("content"):
                        role = item.get("role", "user")
                        content = item.get("content", "").strip()
                        if len(content) > 300:
                            content = content[:300] + "..."
                        messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": prompt})

            answer_text, model_used = self._completion_with_fallback(messages, temperature=0.2)

            # Build sources metadata for UI widget rendering
            sources_meta = []
            for idx, r in enumerate(search_results):
                filename = r.metadata.get("filename") or r.metadata.get("source") or f"Document Chunk {idx+1}"
                sources_meta.append({
                    "metadata": {"filename": filename},
                    "text": r.text
                })

            return RouterExecutionResult(
                query=prompt,
                selected_route="rag",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=answer_text,
                metadata={
                    "search_mode": "hybrid_rrf",
                    "total_chunks_retrieved": len(search_results),
                    "top_chunk_rrf_scores": [r.rrf_score for r in search_results],
                    "sources": sources_meta,
                    "model_used": model_used
                }
            )
        except Exception as e:
            logger.error(f"RAG route execution error: {e}")
            return RouterExecutionResult(
                query=prompt,
                selected_route="rag",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=f"Error executing RAG pipeline: {str(e)}",
                metadata={"error": str(e)}
            )

    def _completion_with_fallback(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> tuple[str, str]:
        """Tries models sequentially from candidate list until one succeeds."""
        candidate_models = settings.FALLBACK_SEQUENCES.get("Fast", [settings.DEFAULT_MODEL])
        errors = []
        for model in candidate_models:
            try:
                response = litellm.completion(
                    model=model,
                    messages=messages,
                    temperature=temperature
                )
                return response.choices[0].message.content, model
            except Exception as err:
                logger.warning(f"Model '{model}' failed: {err}")
                errors.append(f"{model}: {err}")
        
        raise RuntimeError(f"All models failed in fallback sequence: {'; '.join(errors)}")

    def _execute_toolcalling_pipeline(
        self,
        prompt: str,
        classification: IntentClassification,
        provider: Optional[str] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> RouterExecutionResult:
        """Executes LangChain Tool Calling Agent (Tavily / ScrapeGraphAI)."""
        print(f"[ToolCalling Route] Delegating to LangChain Tool Agent...")
        try:
            agent = LangChainToolAgent(model_provider=provider)
            agent_result = agent.run(prompt, history=history, conversation_id=conversation_id, user_id=user_id)

            sources_meta = []
            for tc in agent_result.get("tool_calls_executed", []):
                tool_name = tc.get("tool", "Search Tool")
                result_val = tc.get("result", {})
                if isinstance(result_val, dict) and "results" in result_val:
                    for r_item in result_val.get("results", []):
                        if isinstance(r_item, dict):
                            sources_meta.append({
                                "metadata": {"filename": r_item.get("title") or r_item.get("url") or tool_name},
                                "text": r_item.get("content") or r_item.get("snippet") or ""
                            })
                else:
                    sources_meta.append({
                        "metadata": {"filename": tool_name},
                        "text": str(result_val)[:300]
                    })

            raw_resp = agent_result.get("final_response", "")
            if isinstance(raw_resp, list):
                response_str = "".join(
                    [part.get("text", str(part)) if isinstance(part, dict) else str(part) for part in raw_resp]
                )
            else:
                response_str = str(raw_resp or "")

            return RouterExecutionResult(
                query=prompt,
                selected_route="toolcalling",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=response_str,
                metadata={
                    "tool_calls_executed": agent_result.get("tool_calls_executed", []),
                    "total_iterations": agent_result.get("total_iterations", 1),
                    "sources": sources_meta,
                    "provider": provider or "groq"
                }
            )
        except Exception as e:
            logger.error(f"ToolCalling route execution error: {e}")
            return RouterExecutionResult(
                query=prompt,
                selected_route="toolcalling",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=f"Error executing ToolCalling pipeline: {str(e)}",
                metadata={"error": str(e)}
            )

    def _execute_direct_pipeline(
        self,
        prompt: str,
        classification: IntentClassification,
        provider: Optional[str] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> RouterExecutionResult:
        """Executes Direct LLM Completion."""
        print(f"[Direct Route] Generating direct LLM response...")
        try:
            from app.ai.global_memory import get_global_conversational_context
            global_mem = get_global_conversational_context(user_id=user_id, exclude_conv_id=conversation_id)

            direct_system_prompt = (
                "You are your Multi-Agent AI Assistant, developed by Sachin.\n\n"
                "IDENTITY & CREATOR DIRECTIVE:\n"
                "If asked 'Who are you?', 'Tell me about yourself', or 'Who developed you?', YOU MUST EXPLICITLY STATE:\n"
                "'I am your Multi-Agent AI Assistant, developed by Sachin.'\n\n"
                "APPLICATION CAPABILITIES TO HIGHLIGHT:\n"
                "- Created & Developed By: Sachin\n"
                "- Multi-Agent Orchestrator: Smart Intent Router dynamically classifying queries to Document Agent, Web Search Agent, Coding Agent, or Direct LLM.\n"
                "- Real-Time Web Intelligence: Powered by Tavily Search API & ScrapeGraphAI for live web data and news.\n"
                "- Document Intelligence (RAG): Hybrid Search (Semantic + BM25 + RRF) over MongoDB Vector Store for PDF QA.\n"
                "- Software Engineering Agent: Dedicated code generation, debugging, and script optimization.\n"
                "- Session Memory: Permanent MongoDB conversation storage with cross-chat context awareness.\n\n"
                "OUTPUT FORMATTING REQUIREMENTS:\n"
                "You MUST format your final response strictly into the following 3 markdown sections:\n\n"
                "### 📌 Question Summary\n"
                "(Brief 1-2 sentence summary of the user's question or query.)\n\n"
                "### 💡 Main Content\n"
                "(Main detailed content, solution, explanation, or code satisfying the user's prompt.)\n\n"
                "### 📚 Sources & References\n"
                "(List references, model knowledge base, or relevant links used. If no external sources were used, state 'Internal LLM Knowledge Base'.)\n"
                f"{global_mem}"
            )
            messages = [{"role": "system", "content": direct_system_prompt}]
            if history:
                for item in history[-4:]:
                    if isinstance(item, dict) and item.get("content"):
                        role = item.get("role", "user")
                        content = item.get("content", "").strip()
                        if len(content) > 300:
                            content = content[:300] + "..."
                        messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": prompt})

            answer_text, model_used = self._completion_with_fallback(messages, temperature=0.7)

            return RouterExecutionResult(
                query=prompt,
                selected_route="direct",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=answer_text,
                metadata={
                    "model_used": model_used
                }
            )
        except Exception as e:
            logger.error(f"Direct route execution error: {e}")
            return RouterExecutionResult(
                query=prompt,
                selected_route="direct",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=f"Error executing Direct LLM pipeline: {str(e)}",
                metadata={"error": str(e)}
            )

    def _execute_coding_pipeline(
        self,
        prompt: str,
        classification: IntentClassification,
        provider: Optional[str] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> RouterExecutionResult:
        """Executes Specialized Coding Agent pipeline for software engineering & script generation."""
        print(f"[Coding Agent Route] Delegating to Specialized Software Engineering Agent...")
        try:
            from app.ai.global_memory import get_global_conversational_context
            global_mem = get_global_conversational_context(user_id=user_id, exclude_conv_id=conversation_id)

            coding_system_prompt = (
                "You are your Multi-Agent AI Assistant, developed by Sachin.\n\n"
                "IDENTITY & CREATOR DIRECTIVE:\n"
                "If asked 'Who are you?', 'Tell me about yourself', or 'Who developed you?', YOU MUST EXPLICITLY STATE:\n"
                "'I am your Multi-Agent AI Assistant, developed by Sachin.'\n\n"
                "APPLICATION CAPABILITIES TO HIGHLIGHT:\n"
                "- Created & Developed By: Sachin\n"
                "- Multi-Agent Orchestrator: Smart Intent Router dynamically classifying queries to Document Agent, Web Search Agent, Coding Agent, or Direct LLM.\n"
                "- Real-Time Web Intelligence: Powered by Tavily Search API & ScrapeGraphAI for live web data and news.\n"
                "- Document Intelligence (RAG): Hybrid Search (Semantic + BM25 + RRF) over MongoDB Vector Store for PDF QA.\n"
                "- Software Engineering Agent: Dedicated code generation, debugging, and script optimization.\n"
                "- Session Memory: Permanent MongoDB conversation storage with cross-chat context awareness.\n\n"
                "OUTPUT FORMATTING REQUIREMENTS:\n"
                "You MUST format your final response strictly into the following 3 markdown sections:\n\n"
                "### 📌 Question Summary\n"
                "(Brief 1-2 sentence summary of the programming request or code issue.)\n\n"
                "### 💡 Main Content\n"
                "(Complete code implementation with syntax highlighting, concise comments, and usage instructions.)\n\n"
                "### 📚 Sources & References\n"
                "(State tools, frameworks, programming language versions, or 'Internal LLM Knowledge Base'.)\n"
                f"{global_mem}"
            )
            messages = [{"role": "system", "content": coding_system_prompt}]
            if history:
                for item in history[-4:]:
                    if isinstance(item, dict) and item.get("content"):
                        role = item.get("role", "user")
                        content = item.get("content", "").strip()
                        if len(content) > 300:
                            content = content[:300] + "..."
                        messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": prompt})

            answer_text, model_used = self._completion_with_fallback(messages, temperature=0.1)

            return RouterExecutionResult(
                query=prompt,
                selected_route="coding",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=answer_text,
                metadata={
                    "agent": "Coding Agent",
                    "model_used": model_used
                }
            )
        except Exception as e:
            logger.error(f"Coding route execution error: {e}")
            return RouterExecutionResult(
                query=prompt,
                selected_route="coding",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=f"Error executing Coding Agent pipeline: {str(e)}",
                metadata={"error": str(e)}
            )

    async def stream_route_execution(
        self,
        prompt: str,
        provider: Optional[str] = None,
        top_k_rag: int = 3,
        history: Optional[List[Dict[str, Any]]] = None,
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        """
        Classifies prompt intent, emits SSE start event, then streams LLM tokens in real-time.
        For toolcalling, executes the LangChain Tool Agent (Tavily Search / ScrapeGraph) and streams its response.
        """
        import asyncio
        import json as _json

        logger.info(f"Orchestrator streaming prompt: '{prompt}'")
        classification: IntentClassification = self.router.classify_intent(prompt)
        route = classification.intent

        # Special handling for Web Search / Toolcalling route
        if route == "toolcalling":
            start_meta = _json.dumps({
                "event": "start",
                "selected_route": route,
                "classification_reasoning": classification.reasoning,
                "confidence": classification.confidence,
                "model_used": "LangChain Web Agent (Tavily/ScrapeGraph)",
            })
            yield f"data: {start_meta}\n\n"

            try:
                agent_res = await asyncio.to_thread(
                    self._execute_toolcalling_pipeline,
                    prompt,
                    classification,
                    provider,
                    history,
                    conversation_id,
                    user_id
                )
                final_text = agent_res.response or "No response from Web Search Agent."
                # Stream chunk by chunk for fluid UX
                chunk_size = 20
                for i in range(0, len(final_text), chunk_size):
                    chunk = final_text[i:i+chunk_size]
                    yield f"data: {_json.dumps({'content': chunk})}\n\n"
                    await asyncio.sleep(0.015)
            except Exception as e:
                logger.error(f"Toolcalling streaming error: {e}")
                yield f"data: {_json.dumps({'error': str(e)})}\n\n"

            yield "data: [DONE]\n\n"
            return

        from app.ai.global_memory import get_global_conversational_context
        global_mem = get_global_conversational_context(user_id=user_id, exclude_conv_id=conversation_id)

        system_instruction = (
            "You are your Multi-Agent AI Assistant, developed by Sachin.\n\n"
            "IDENTITY & CREATOR DIRECTIVE:\n"
            "If asked 'Who are you?', 'Tell me about yourself', or 'Who developed you?', YOU MUST EXPLICITLY STATE:\n"
            "'I am your Multi-Agent AI Assistant, developed by Sachin.'\n\n"
            "APPLICATION CAPABILITIES TO HIGHLIGHT:\n"
            "- Created & Developed By: Sachin\n"
            "- Multi-Agent Orchestrator: Smart Intent Router dynamically classifying queries to Document Agent, Web Search Agent, Coding Agent, or Direct LLM.\n"
            "- Real-Time Web Intelligence: Powered by Tavily Search API & ScrapeGraphAI for live web data and news.\n"
            "- Document Intelligence (RAG): Hybrid Search (Semantic + BM25 + RRF) over MongoDB Vector Store for PDF QA.\n"
            "- Software Engineering Agent: Dedicated code generation, debugging, and script optimization.\n"
            "- Session Memory: Permanent MongoDB conversation storage with cross-chat context awareness.\n\n"
            "OUTPUT FORMATTING REQUIREMENTS:\n"
            "You MUST format your final response strictly into the following 3 markdown sections:\n\n"
            "### 📌 Question Summary\n"
            "(Brief 1-2 sentence summary of the user's question or request.)\n\n"
            "### 💡 Main Content\n"
            "(Main detailed answer satisfying the user request.)\n\n"
            "### 📚 Sources & References\n"
            "(Bulleted list of sources, tools, or 'Internal LLM Knowledge Base'.)\n"
            f"{global_mem}"
        )

        if route == "rag":
            try:
                from app.rag.hybrid_search import hybrid_search_engine
                search_results = hybrid_search_engine.search(query=prompt, top_k=top_k_rag, user_id=user_id)
                context_str = "\n\n".join(
                    [f"--- Document Chunk {i+1} (RRF Score: {r.rrf_score}) ---\n{r.text}" for i, r in enumerate(search_results)]
                ) if search_results else "No relevant document chunks found in vector store."
                system_instruction += f"\n\nDOCUMENT CONTEXT:\n{context_str}"
            except Exception as e:
                logger.warning(f"RAG context retrieval failed during streaming: {e}")

        messages = [{"role": "system", "content": system_instruction}]
        if history:
            for item in history[-4:]:
                if isinstance(item, dict) and item.get("content"):
                    role = item.get("role", "user")
                    content = item.get("content", "").strip()
                    if len(content) > 300:
                        content = content[:300] + "..."
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})

        candidate_models = settings.FALLBACK_SEQUENCES.get("Fast", [settings.DEFAULT_MODEL])
        stream_resp = None
        successful_model = None

        for model in candidate_models:
            try:
                stream_resp = await litellm.acompletion(
                    model=model,
                    messages=messages,
                    stream=True,
                    temperature=0.1 if route == "coding" else 0.7,
                )
                successful_model = model
                break
            except Exception as err:
                logger.warning(f"Streaming model '{model}' failed: {err}")

        if not stream_resp or not successful_model:
            yield f"data: {_json.dumps({'error': 'All models failed for streaming'})}\n\n"
            return

        start_meta = _json.dumps({
            "event": "start",
            "selected_route": route,
            "classification_reasoning": classification.reasoning,
            "confidence": classification.confidence,
            "model_used": successful_model,
        })
        yield f"data: {start_meta}\n\n"

        streamed_any = False
        try:
            async for chunk in stream_resp:
                delta = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else None
                if delta:
                    streamed_any = True
                    yield f"data: {_json.dumps({'content': delta})}\n\n"
        except Exception as e:
            logger.error(f"Stream chunk error: {e}")
            if not streamed_any:
                try:
                    fallback_text, _ = await asyncio.to_thread(
                        self._completion_with_fallback,
                        messages,
                        0.1 if route == "coding" else 0.7
                    )
                    chunk_size = 25
                    for i in range(0, len(fallback_text), chunk_size):
                        yield f"data: {_json.dumps({'content': fallback_text[i:i+chunk_size]})}\n\n"
                        await asyncio.sleep(0.01)
                except Exception as fb_err:
                    yield f"data: {_json.dumps({'error': str(fb_err)})}\n\n"
            else:
                yield f"data: {_json.dumps({'error': str(e)})}\n\n"

        yield "data: [DONE]\n\n"


# Singleton instance
orchestrator = SmartMultiAgentOrchestrator()


