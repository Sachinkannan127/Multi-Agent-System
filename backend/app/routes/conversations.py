from typing import Any, Dict, List, Optional
import time
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.db import get_db
from app.routes.auth import verify_clerk_session

router = APIRouter(prefix="/conversations", tags=["Permanent Conversations Memory"])


class SaveConversationRequest(BaseModel):
    id: str = Field(..., description="Unique conversation ID")
    title: str = Field(..., description="Conversation title")
    thread_id: Optional[str] = Field(default=None)
    folder_id: Optional[str] = Field(default=None, description="Optional folder ID")
    is_pinned: Optional[bool] = Field(default=False)
    messages: List[Dict[str, Any]] = Field(default_factory=list)


@router.get("", summary="Get all permanent conversations from MongoDB")
@router.get("/", include_in_schema=False)
def list_conversations(
    folder_id: Optional[str] = None,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Fetches stored conversations from MongoDB, strictly scoped to the authenticated Clerk user.
    """
    try:
        db = get_db()
        if db is None:
            return []

        session = verify_clerk_session(authorization, x_user_id)
        user_id = session.get("user_id")

        if not user_id:
            return []

        collection = db["conversations"]
        query: Dict[str, Any] = {"user_id": user_id}
        if folder_id is not None:
            if folder_id == "" or folder_id.lower() == "unfiled":
                query["$or"] = [{"folder_id": None}, {"folder_id": ""}, {"folder_id": {"$exists": False}}]
            else:
                query["folder_id"] = folder_id

        cursor = collection.find(query, {"_id": 0}).sort("updated_at", -1).limit(100)
        return list(cursor)
    except Exception:
        return []


@router.post("/save", summary="Save or update permanent conversation in MongoDB")
def save_conversation(
    request: SaveConversationRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Saves or updates a conversation session and its messages permanently in MongoDB with Clerk user ID.
    """
    try:
        db = get_db()
        if db is None:
            return {"status": "error", "message": "MongoDB not connected"}

        session = verify_clerk_session(authorization, x_user_id)
        user_id = session.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to save conversation",
            )

        collection = db["conversations"]
        now = time.time()

        doc: Dict[str, Any] = {
            "id": request.id,
            "title": request.title,
            "threadId": request.thread_id or f"thread_{request.id}",
            "messages": request.messages,
            "user_id": user_id,
            "updated_at": now,
        }
        if request.folder_id is not None:
            doc["folder_id"] = request.folder_id
        if request.is_pinned is not None:
            doc["is_pinned"] = request.is_pinned

        # Preserve existing created_at or insert now
        collection.update_one(
            {"id": request.id, "user_id": user_id},
            {"$set": doc, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return {"status": "success", "conversation_id": request.id, "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save conversation to MongoDB: {str(e)}",
        )


@router.delete("/{conversation_id}", summary="Delete permanent conversation from MongoDB")
def delete_conversation(
    conversation_id: str,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_guest_id: Optional[str] = Header(None, alias="X-Guest-Id"),
):
    """
    Deletes a conversation permanently from MongoDB, scoped to the requesting user.
    """
    try:
        db = get_db()
        if db is not None:
            session = verify_clerk_session(authorization, x_user_id, x_guest_id)
            user_id = session.get("user_id")

            delete_filter = {"id": conversation_id}
            if user_id:
                delete_filter["user_id"] = user_id

            res = db["conversations"].delete_one(delete_filter)
            return {"status": "success", "deleted_id": conversation_id, "deleted_count": res.deleted_count}
        return {"status": "success", "deleted_id": conversation_id, "deleted_count": 0}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete conversation: {str(e)}",
        )


class AutoTitleRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="First message prompt")
    model: Optional[str] = Field(default=None)


class AutoTitleResponse(BaseModel):
    title: str
    status: str = "success"


@router.post("/autotitle", response_model=AutoTitleResponse, summary="Generate dynamic smart title for conversation")
async def generate_conversation_title(request: AutoTitleRequest):
    """
    Dynamically generates a clean, concise 3 to 6 word title from the user prompt.
    """
    prompt = request.prompt.strip()
    if not prompt:
        return AutoTitleResponse(title="New Conversation")

    # Fast fallback prompt with LLM
    try:
        import litellm
        from app.core.config import settings

        candidate_models = settings.FALLBACK_SEQUENCES.get("Fast", [settings.DEFAULT_MODEL])
        sys_prompt = (
            "You are an expert concise title generator. "
            "Generate a clear, high-quality, professional 3 to 6 word title (without quotes, markdown, or punctuation) for this user question/query."
        )

        for m in candidate_models:
            try:
                res = await litellm.acompletion(
                    model=m,
                    messages=[
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=20,
                    temperature=0.3
                )
                generated_title = res.choices[0].message.content.strip().strip('"\'`').strip()
                if generated_title and len(generated_title) > 2:
                    generated_title = generated_title.rstrip('.!?')
                    return AutoTitleResponse(title=generated_title[:60])
            except Exception:
                continue
    except Exception:
        pass

    # Heuristic fallback: clean up first words
    words = prompt.split()
    if len(words) <= 6:
        fallback_title = prompt
    else:
        fallback_title = " ".join(words[:6]) + "..."
    return AutoTitleResponse(title=fallback_title[:50])


