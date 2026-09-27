from typing import Any, Dict, List, Optional
import time
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.db import get_db

router = APIRouter(prefix="/conversations", tags=["Permanent Conversations Memory"])


class SaveConversationRequest(BaseModel):
    id: str = Field(..., description="Unique conversation ID")
    title: str = Field(..., description="Conversation title")
    thread_id: Optional[str] = Field(default=None)
    messages: List[Dict[str, Any]] = Field(default_factory=list)


@router.get("", summary="Get all permanent conversations from MongoDB")
@router.get("/", include_in_schema=False)
def list_conversations():
    """
    Fetches all permanently stored conversations from MongoDB sorted by last update time.
    """
    try:
        db = get_db()
        if db is None:
            return []

        collection = db["conversations"]
        cursor = collection.find({}, {"_id": 0}).sort("updated_at", -1).limit(50)
        return list(cursor)
    except Exception as e:
        return []


@router.post("/save", summary="Save or update permanent conversation in MongoDB")
def save_conversation(request: SaveConversationRequest):
    """
    Saves or updates a conversation session and its messages permanently in MongoDB.
    """
    try:
        db = get_db()
        if db is None:
            return {"status": "error", "message": "MongoDB not connected"}

        collection = db["conversations"]
        now = time.time()

        doc = {
            "id": request.id,
            "title": request.title,
            "threadId": request.thread_id or f"thread_{request.id}",
            "messages": request.messages,
            "updated_at": now,
        }

        collection.update_one({"id": request.id}, {"$set": doc}, upsert=True)
        return {"status": "success", "conversation_id": request.id}
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
