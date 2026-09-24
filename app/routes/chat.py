import os
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import litellm
from app.core.config import settings

# Suppress debug logs/messages from litellm in console
litellm.suppress_debug_info = True
litellm.drop_params = True

# Ensure API keys are set in environment for litellm
if settings.GEMINI_API_KEY:
    os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
if settings.GROQ_API_KEY:
    os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
if settings.MISTRAL_API_KEY:
    os.environ["MISTRAL_API_KEY"] = settings.MISTRAL_API_KEY

router = APIRouter(prefix="/chat", tags=["ChatBot"])


class ChatMessage(BaseModel):
    role: str = Field(
        ...,
        description="Role of the speaker: 'user', 'assistant', or 'system'",
        json_schema_extra={"example": "user"},
    )
    content: str = Field(
        ...,
        description="Message content",
        json_schema_extra={"example": "Hello!"},
    )


class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="The user's prompt or message",
        json_schema_extra={"example": "Explain quantum computing in simple terms."},
    )
    mode: Optional[str] = Field(
        default="Fast",
        description="Tier selection: 'Slow' (Gemini), 'Fast' (Groq), 'Pro' (Mistral)",
        json_schema_extra={"example": "Fast"},
    )
    history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="Optional conversation history",
    )
    system_prompt: Optional[str] = Field(
        default="You are a helpful, friendly, and concise AI assistant.",
        description="Optional system prompt to guide the AI behavior",
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional custom model identifier (overrides mode if provided)",
        json_schema_extra={"example": ""},
    )
    stream: Optional[bool] = Field(
        default=False,
        description="Set to true to stream response tokens in real-time (SSE)",
        json_schema_extra={"example": False},
    )


class ChatResponse(BaseModel):
    reply: str
    mode_used: str
    model_used: str
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
    status: str = "success"


async def generate_stream_events(request: ChatRequest):
    """
    Async generator for SSE token streaming with sequential fallback.
    """
    selected_mode = (request.mode or "").strip()
    custom_model = (request.model or "").strip()

    # Determine candidate model sequence
    if custom_model and custom_model.lower() != "string":
        raw_candidates = [custom_model] + settings.FALLBACK_SEQUENCES.get(
            "Fast", [settings.DEFAULT_MODEL]
        )
        mode_label = "Custom"
    elif selected_mode in settings.FALLBACK_SEQUENCES:
        raw_candidates = settings.FALLBACK_SEQUENCES[selected_mode]
        mode_label = selected_mode
    else:
        raw_candidates = settings.FALLBACK_SEQUENCES["Fast"]
        mode_label = "Fast"

    candidate_models = []
    for m in raw_candidates:
        if m not in candidate_models:
            candidate_models.append(m)

    # Build messages payload
    messages = []
    if request.system_prompt:
        messages.append({"role": "system", "content": request.system_prompt})

    if request.history:
        for msg in request.history:
            messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": request.message})

    # Sequential Fallback Execution for Streaming
    stream_response = None
    successful_model = None
    errors = []

    for model_name in candidate_models:
        try:
            stream_response = await litellm.acompletion(
                model=model_name,
                messages=messages,
                stream=True,
            )
            successful_model = model_name
            break
        except Exception as err:
            err_msg = str(err).splitlines()[0] if str(err) else "Unknown error"
            errors.append(f"{model_name} failed: {err_msg}")

    if not stream_response or not successful_model:
        err_event = json.dumps({
            "error": f"All models failed for mode '{mode_label}'. Attempt errors: {'; '.join(errors)}"
        })
        yield f"data: {err_event}\n\n"
        return

    primary_model = candidate_models[0]
    fallback_used = successful_model != primary_model

    # 1. Send initial metadata SSE event
    start_meta = json.dumps({
        "event": "start",
        "mode_used": mode_label,
        "model_used": successful_model,
        "fallback_used": fallback_used,
        "fallback_reason": "; ".join(errors) if fallback_used else None,
    })
    yield f"data: {start_meta}\n\n"

    # 2. Stream chunk tokens
    try:
        async for chunk in stream_response:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                content = getattr(delta, "content", "") or ""
                if content:
                    chunk_json = json.dumps({"content": content})
                    yield f"data: {chunk_json}\n\n"
    except Exception as stream_err:
        err_json = json.dumps({"error": f"Stream interrupted: {str(stream_err)}"})
        yield f"data: {err_json}\n\n"

    # 3. Send done signal
    yield "data: [DONE]\n\n"


@router.post("/stream", summary="Stream chatbot response tokens via Server-Sent Events (SSE)")
@router.post("/stream/", include_in_schema=False)
async def chat_stream_endpoint(request: ChatRequest):
    """
    Real-time streaming chatbot endpoint (Server-Sent Events / SSE).
    """
    return StreamingResponse(
        generate_stream_events(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("", response_model=ChatResponse, summary="Send a message to the chatbot")
@router.post("/", response_model=ChatResponse, include_in_schema=False)
async def chat_endpoint(request: ChatRequest):
    """
    Chatbot endpoint with Tier selection, optional streaming (`stream: true`), and Sequential Fallback.
    """
    # Handle stream request if requested in body
    if request.stream:
        return StreamingResponse(
            generate_stream_events(request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    selected_mode = (request.mode or "").strip()
    custom_model = (request.model or "").strip()

    # Determine candidate model sequence
    if custom_model and custom_model.lower() != "string":
        raw_candidates = [custom_model] + settings.FALLBACK_SEQUENCES.get(
            "Fast", [settings.DEFAULT_MODEL]
        )
        mode_label = "Custom"
    elif selected_mode in settings.FALLBACK_SEQUENCES:
        raw_candidates = settings.FALLBACK_SEQUENCES[selected_mode]
        mode_label = selected_mode
    else:
        raw_candidates = settings.FALLBACK_SEQUENCES["Fast"]
        mode_label = "Fast"

    # Remove duplicates while preserving exact priority order
    candidate_models = []
    for m in raw_candidates:
        if m not in candidate_models:
            candidate_models.append(m)

    # Build messages payload
    messages = []
    if request.system_prompt:
        messages.append({"role": "system", "content": request.system_prompt})

    if request.history:
        for msg in request.history:
            messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": request.message})

    # Sequential Fallback Execution
    errors = []
    response = None
    successful_model = None

    for model_name in candidate_models:
        try:
            response = await litellm.acompletion(
                model=model_name,
                messages=messages,
            )
            successful_model = model_name
            break
        except Exception as err:
            err_msg = str(err).splitlines()[0] if str(err) else "Unknown error"
            errors.append(f"{model_name} failed: {err_msg}")

    if not response or not successful_model:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"All models failed for mode '{mode_label}'. Attempt errors: {'; '.join(errors)}",
        )

    primary_model = candidate_models[0]
    fallback_used = successful_model != primary_model

    return ChatResponse(
        reply=response.choices[0].message.content,
        mode_used=mode_label,
        model_used=successful_model,
        fallback_used=fallback_used,
        fallback_reason="; ".join(errors) if fallback_used else None,
        status="success",
    )
