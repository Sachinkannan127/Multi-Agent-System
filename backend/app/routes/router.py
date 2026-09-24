from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.ai.router import intent_router, IntentClassification
from app.ai.orchestrator import orchestrator, RouterExecutionResult

router = APIRouter(prefix="/router", tags=["Smart Intent Router"])


class RouterChatRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="User prompt or question to route automatically",
        json_schema_extra={"example": "What are the candidate's skills in the uploaded resume?"},
    )
    provider: Optional[str] = Field(
        default="gemini",
        description="LLM provider for tool calling/execution: 'gemini' or 'groq'",
        json_schema_extra={"example": "gemini"},
    )
    top_k: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Number of vector chunks to retrieve if RAG route is selected",
        json_schema_extra={"example": 3},
    )


class ClassifyPromptRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="User prompt to classify",
        json_schema_extra={"example": "Scrape techcrunch.com for latest AI news"},
    )


class RouterChatResponse(BaseModel):
    query: str
    selected_route: str
    classification_reasoning: str
    confidence: float
    response: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


@router.post("/chat", response_model=RouterChatResponse, summary="Smart Intent Router Chat")
def smart_router_chat(request: RouterChatRequest):
    """
    Intelligent Router Endpoint:
    Classifies the user prompt into one of three routes and dispatches execution:
    1. 'rag': For PDF, document, resume, or vector store queries.
    2. 'toolcalling': For real-time web search or web scraping (Tavily / ScrapeGraphAI).
    3. 'direct': For basic conversational chat or general LLM completion.
    """
    try:
        result: RouterExecutionResult = orchestrator.route_and_execute(
            prompt=request.prompt,
            provider=request.provider,
            top_k_rag=request.top_k,
        )
        return RouterChatResponse(
            query=result.query,
            selected_route=result.selected_route,
            classification_reasoning=result.classification_reasoning,
            confidence=result.confidence,
            response=result.response,
            metadata=result.metadata,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Smart Router execution failed: {str(e)}",
        )


@router.post("/classify", response_model=IntentClassification, summary="Classify Prompt Intent")
def classify_prompt_intent(request: ClassifyPromptRequest):
    """
    Inspects intent classification for a prompt without executing the route.
    Returns classified route ('rag', 'toolcalling', 'direct'), confidence, and reasoning.
    """
    try:
        classification = intent_router.classify_intent(request.prompt)
        return classification
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Intent classification failed: {str(e)}",
        )
