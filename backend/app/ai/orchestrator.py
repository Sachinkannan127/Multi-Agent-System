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

        # Route A: RAG (Document / PDF Vector Store QA)
        if route == "rag":
            return self._execute_rag_pipeline(prompt, classification, top_k=top_k_rag, history=history, conversation_id=conversation_id)

        # Route B: Tool Calling Agent (Tavily / ScrapeGraphAI)
        elif route == "toolcalling":
            return self._execute_toolcalling_pipeline(prompt, classification, provider=provider, history=history, conversation_id=conversation_id)

        # Route C: Direct LLM Completion
        else:
            return self._execute_direct_pipeline(prompt, classification, provider=provider, history=history, conversation_id=conversation_id)

    def _execute_rag_pipeline(
        self,
        prompt: str,
        classification: IntentClassification,
        top_k: int = 3,
        history: Optional[List[Dict[str, Any]]] = None,
        conversation_id: Optional[str] = None,
    ) -> RouterExecutionResult:
        """Executes Hybrid Search (Semantic + BM25 + RRF) + LLM synthesis."""
        print(f"[RAG Route] Executing Hybrid Search (Semantic + BM25 + RRF) for context...")
        try:
            from app.rag.hybrid_search import hybrid_search_engine
            from app.ai.global_memory import get_global_conversational_context

            search_results = hybrid_search_engine.search(query=prompt, top_k=top_k)
            global_mem = get_global_conversational_context(exclude_conv_id=conversation_id)

            context_str = "\n\n".join(
                [f"--- Document Chunk {i+1} (RRF Score: {r.rrf_score}) ---\n{r.text}" for i, r in enumerate(search_results)]
            ) if search_results else "No relevant document chunks found in vector store."

            system_instruction = (
                "You are an expert RAG Assistant. Answer the user question accurately based on the provided document context below.\n\n"
                "OUTPUT FORMATTING REQUIREMENTS:\n"
                "You MUST structure your response strictly into the following 3 markdown sections:\n"
                "### 📌 Question Summary\n"
                "(Brief 1-2 sentence summary of the user's question)\n\n"
                "### 💡 Response\n"
                "(Main detailed answer satisfying the user request based on context)\n\n"
                "### 📚 References & Sources\n"
                "(Bulleted list of document chunks, files, or RRF scores used)\n\n"
                f"DOCUMENT CONTEXT:\n{context_str}"
                f"{global_mem}"
            )

            messages = [{"role": "system", "content": system_instruction}]
            if history:
                for item in history:
                    if isinstance(item, dict) and item.get("content"):
                        messages.append({"role": item.get("role", "user"), "content": item.get("content")})
            messages.append({"role": "user", "content": prompt})

            answer_text, model_used = self._completion_with_fallback(messages, temperature=0.2)

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
    ) -> RouterExecutionResult:
        """Executes LangChain Tool Calling Agent (Tavily / ScrapeGraphAI)."""
        print(f"[ToolCalling Route] Delegating to LangChain Tool Agent...")
        try:
            agent = LangChainToolAgent(model_provider=provider)
            agent_result = agent.run(prompt, history=history, conversation_id=conversation_id)

            return RouterExecutionResult(
                query=prompt,
                selected_route="toolcalling",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=agent_result.get("final_response", ""),
                metadata={
                    "tool_calls_executed": agent_result.get("tool_calls_executed", []),
                    "total_iterations": agent_result.get("total_iterations", 1),
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
    ) -> RouterExecutionResult:
        """Executes Direct LLM Completion."""
        print(f"[Direct Route] Generating direct LLM response...")
        try:
            from app.ai.global_memory import get_global_conversational_context
            global_mem = get_global_conversational_context(exclude_conv_id=conversation_id)

            direct_system_prompt = (
                "You are a helpful, friendly, and expert AI assistant.\n\n"
                "OUTPUT FORMATTING REQUIREMENTS:\n"
                "You MUST structure your response strictly into the following 3 markdown sections:\n"
                "### 📌 Question Summary\n"
                "(Brief 1-2 sentence summary of the user's query)\n\n"
                "### 💡 Response\n"
                "(Main detailed content, solution, explanation, or code)\n\n"
                "### 📚 References & Sources\n"
                "(List references, model knowledge base, or relevant links used)"
                f"{global_mem}"
            )
            messages = [{"role": "system", "content": direct_system_prompt}]
            if history:
                for item in history:
                    if isinstance(item, dict) and item.get("content"):
                        messages.append({"role": item.get("role", "user"), "content": item.get("content")})
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


# Global orchestrator singleton instance
orchestrator = SmartMultiAgentOrchestrator()
