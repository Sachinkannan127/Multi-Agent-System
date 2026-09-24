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
    ) -> RouterExecutionResult:
        """
        Main entry point: classifies prompt and dispatches to the corresponding pipeline.
        """
        logger.info(f"Orchestrator evaluating prompt: '{prompt}'")
        print(f"[Orchestrator] Classifying prompt: '{prompt}'")

        # 1. Classify Intent
        classification: IntentClassification = self.router.classify_intent(prompt)
        route = classification.intent
        print(f"[Orchestrator] Route selected: '{route.upper()}' (Confidence: {classification.confidence}) - {classification.reasoning}")

        # 2. Dispatch to Selected Pipeline

        # Route A: RAG (Document / PDF Vector Store QA)
        if route == "rag":
            return self._execute_rag_pipeline(prompt, classification, top_k=top_k_rag)

        # Route B: Tool Calling Agent (Tavily / ScrapeGraphAI)
        elif route == "toolcalling":
            return self._execute_toolcalling_pipeline(prompt, classification, provider=provider)

        # Route C: Direct LLM Completion
        else:
            return self._execute_direct_pipeline(prompt, classification, provider=provider)

    def _execute_rag_pipeline(
        self,
        prompt: str,
        classification: IntentClassification,
        top_k: int = 3,
    ) -> RouterExecutionResult:
        """Executes Hybrid Search (Semantic + BM25 + RRF) + LLM synthesis."""
        print(f"[RAG Route] Executing Hybrid Search (Semantic + BM25 + RRF) for context...")
        try:
            from app.rag.hybrid_search import hybrid_search_engine
            search_results = hybrid_search_engine.search(query=prompt, top_k=top_k)

            context_str = "\n\n".join(
                [f"--- Document Chunk {i+1} (RRF Score: {r.rrf_score}) ---\n{r.text}" for i, r in enumerate(search_results)]
            ) if search_results else "No relevant document chunks found in vector store."

            system_instruction = (
                "You are an expert RAG Assistant. Answer the user question accurately based ONLY on the provided document context below.\n"
                "If the information is not contained in the context, state clearly what is missing.\n\n"
                f"DOCUMENT CONTEXT:\n{context_str}"
            )

            messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ]

            model_name = settings.DEFAULT_MODEL
            response = litellm.completion(
                model=model_name,
                messages=messages,
                temperature=0.2
            )
            answer_text = response.choices[0].message.content

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
                    "model_used": model_name
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

    def _execute_toolcalling_pipeline(
        self,
        prompt: str,
        classification: IntentClassification,
        provider: Optional[str] = None,
    ) -> RouterExecutionResult:
        """Executes LangChain Tool Calling Agent (Tavily / ScrapeGraphAI)."""
        print(f"[ToolCalling Route] Delegating to LangChain Tool Agent...")
        try:
            agent = LangChainToolAgent(model_provider=provider)
            agent_result = agent.run(prompt)

            return RouterExecutionResult(
                query=prompt,
                selected_route="toolcalling",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=agent_result.get("final_response", ""),
                metadata={
                    "tool_calls_executed": agent_result.get("tool_calls_executed", []),
                    "total_iterations": agent_result.get("total_iterations", 1),
                    "provider": provider or "gemini"
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
    ) -> RouterExecutionResult:
        """Executes Direct LLM Completion."""
        print(f"[Direct Route] Generating direct LLM response...")
        try:
            model_name = settings.DEFAULT_MODEL
            messages = [
                {"role": "system", "content": "You are a helpful, friendly, and concise AI assistant."},
                {"role": "user", "content": prompt}
            ]

            response = litellm.completion(
                model=model_name,
                messages=messages,
                temperature=0.7
            )
            answer_text = response.choices[0].message.content

            return RouterExecutionResult(
                query=prompt,
                selected_route="direct",
                classification_reasoning=classification.reasoning,
                confidence=classification.confidence,
                response=answer_text,
                metadata={
                    "model_used": model_name
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
