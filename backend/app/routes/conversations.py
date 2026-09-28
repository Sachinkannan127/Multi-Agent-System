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
def list_conversations(authorization: Optional[str] = Header(None)):
    """
    Fetches stored conversations from MongoDB, optionally scoped by authenticated Clerk user.
    """
    try:
        db = get_db()
        if db is None:
            return []

        session = verify_clerk_session(authorization)
        user_id = session.get("user_id")

        collection = db["conversations"]
        # If authenticated, fetch user's chats or legacy unauthenticated chats
        query = {"$or": [{"user_id": user_id}, {"user_id": None}, {"user_id": "guest_user"}]} if user_id and user_id != "guest_user" else {}
        cursor = collection.find(query, {"_id": 0}).sort("updated_at", -1).limit(50)
        return list(cursor)
    except Exception as e:
        return []


@router.post("/save", summary="Save or update permanent conversation in MongoDB")
def save_conversation(request: SaveConversationRequest, authorization: Optional[str] = Header(None)):
    """
    Saves or updates a conversation session and its messages permanently in MongoDB with Clerk user ID.
    """
    try:
        db = get_db()
        if db is None:
            return {"status": "error", "message": "MongoDB not connected"}

        session = verify_clerk_session(authorization)
        user_id = session.get("user_id", "guest_user")

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

        collection.update_one({"id": request.id}, {"$set": doc}, upsert=True)
        return {"status": "success", "conversation_id": request.id, "user_id": user_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save conversation to MongoDB: {str(e)}",
        )


@router.delete("/{conversation_id}", summary="Delete permanent conversation from MongoDB")
def delete_conversation(conversation_id: str):
    """
    Deletes a conversation permanently from MongoDB.
    """
    try:
        db = get_db()
        if db is not None:
            db["conversations"].delete_one({"id": conversation_id})
        return {"status": "success", "deleted_id": conversation_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete conversation: {str(e)}",
        )
