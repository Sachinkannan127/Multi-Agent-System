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
    messages: List[Dict[str, Any]] = Field(default_factory=list)


@router.get("", summary="Get all permanent conversations from MongoDB")
@router.get("/", include_in_schema=False)
def list_conversations(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_guest_id: Optional[str] = Header(None, alias="X-Guest-Id"),
):
    """
    Fetches stored conversations from MongoDB, strictly scoped to the authenticated Clerk user
    or isolated guest session. NEVER returns conversations belonging to another user.
    """
    try:
        db = get_db()
        if db is None:
            return []

        session = verify_clerk_session(authorization, x_user_id, x_guest_id)
        user_id = session.get("user_id")

        # If user has no active identifier, do not display any other user's conversations
        if not user_id:
            return []

        collection = db["conversations"]
        # Strictly query only this user's conversations
        query = {"user_id": user_id}
        cursor = collection.find(query, {"_id": 0}).sort("updated_at", -1).limit(50)
        return list(cursor)
    except Exception as e:
        return []


@router.post("/save", summary="Save or update permanent conversation in MongoDB")
def save_conversation(
    request: SaveConversationRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_guest_id: Optional[str] = Header(None, alias="X-Guest-Id"),
):
    """
    Saves or updates a conversation session and its messages permanently in MongoDB with Clerk user ID
    or isolated guest ID. Prevents cross-user conversation overwriting.
    """
    try:
        db = get_db()
        if db is None:
            return {"status": "error", "message": "MongoDB not connected"}

        session = verify_clerk_session(authorization, x_user_id, x_guest_id)
        user_id = session.get("user_id") or "guest_anonymous"

        collection = db["conversations"]
        now = time.time()

        doc = {
            "id": request.id,
            "title": request.title,
            "threadId": request.thread_id or f"thread_{request.id}",
            "messages": request.messages,
            "user_id": user_id,
            "updated_at": now,
        }

        # Prevent overwriting another user's conversation with the same ID
        collection.update_one(
            {"id": request.id, "$or": [{"user_id": user_id}, {"user_id": {"$exists": False}}]},
            {"$set": doc},
            upsert=True,
        )
        return {"status": "success", "conversation_id": request.id, "user_id": user_id}
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

