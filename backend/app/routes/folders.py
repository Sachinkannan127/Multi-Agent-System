from typing import Any, Dict, List, Optional
import time
import uuid
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.db import get_db
from app.routes.auth import verify_clerk_session

router = APIRouter(prefix="/folders", tags=["User Chat Folders"])


class CreateFolderRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Folder name")
    color: Optional[str] = Field(default="#FF6B35", description="Folder color accent hex or name")
    icon: Optional[str] = Field(default="📁", description="Folder icon emoji or svg name")


class UpdateFolderRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    color: Optional[str] = Field(default=None)
    icon: Optional[str] = Field(default=None)
    is_collapsed: Optional[bool] = Field(default=None)


class MoveConversationRequest(BaseModel):
    folder_id: Optional[str] = Field(default=None, description="Target folder ID or None to unassign")


@router.get("", summary="List all chat folders for authenticated user")
@router.get("/", include_in_schema=False)
def list_folders(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Returns all chat folders created by the authenticated user from MongoDB `chat_folders` collection,
    including the count of active conversations in each folder.
    """
    db = get_db()
    if db is None:
        return []

    session = verify_clerk_session(authorization, x_user_id)
    user_id = session.get("user_id")
    if not user_id:
        return []

    folders_col = db["chat_folders"]
    convs_col = db["conversations"]

    folders = list(folders_col.find({"user_id": user_id}, {"_id": 0}).sort("created_at", 1))

    # Compute conversation count per folder
    for f in folders:
        fid = f.get("id")
        f["conversation_count"] = convs_col.count_documents({"user_id": user_id, "folder_id": fid})

    return folders


@router.post("", summary="Create a new chat folder in MongoDB")
@router.post("/", include_in_schema=False)
def create_folder(
    request: CreateFolderRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Creates a new user chat folder stored in MongoDB.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not connected",
        )

    session = verify_clerk_session(authorization, x_user_id)
    user_id = session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to create folders",
        )

    folders_col = db["chat_folders"]
    now = time.time()
    folder_id = f"folder_{int(now)}_{uuid.uuid4().hex[:6]}"

    folder_doc = {
        "id": folder_id,
        "user_id": user_id,
        "name": request.name.strip(),
        "color": request.color or "#FF6B35",
        "icon": request.icon or "📁",
        "is_collapsed": False,
        "created_at": now,
        "updated_at": now,
    }

    folders_col.insert_one(folder_doc)
    folder_doc.pop("_id", None)
    folder_doc["conversation_count"] = 0

    return {"status": "success", "folder": folder_doc}


@router.put("/{folder_id}", summary="Update or rename chat folder in MongoDB")
def update_folder(
    folder_id: str,
    request: UpdateFolderRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Updates or renames a chat folder in MongoDB.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not connected",
        )

    session = verify_clerk_session(authorization, x_user_id)
    user_id = session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to update folders",
        )

    folders_col = db["chat_folders"]
    updates: Dict[str, Any] = {"updated_at": time.time()}

    if request.name is not None:
        updates["name"] = request.name.strip()
    if request.color is not None:
        updates["color"] = request.color
    if request.icon is not None:
        updates["icon"] = request.icon
    if request.is_collapsed is not None:
        updates["is_collapsed"] = request.is_collapsed

    res = folders_col.update_one(
        {"id": folder_id, "user_id": user_id},
        {"$set": updates},
    )

    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    updated_folder = folders_col.find_one({"id": folder_id, "user_id": user_id}, {"_id": 0})
    return {"status": "success", "folder": updated_folder}


@router.delete("/{folder_id}", summary="Delete a chat folder from MongoDB")
def delete_folder(
    folder_id: str,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Deletes a folder from MongoDB and unassigns conversations belonging to it.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not connected",
        )

    session = verify_clerk_session(authorization, x_user_id)
    user_id = session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to delete folders",
        )

    folders_col = db["chat_folders"]
    convs_col = db["conversations"]

    res = folders_col.delete_one({"id": folder_id, "user_id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    # Unassign conversations that were in this folder
    convs_col.update_many(
        {"user_id": user_id, "folder_id": folder_id},
        {"$unset": {"folder_id": ""}, "$set": {"updated_at": time.time()}},
    )

    return {"status": "success", "deleted_folder_id": folder_id}


@router.put("/conversations/{conversation_id}/move", summary="Move conversation to folder")
def move_conversation_to_folder(
    conversation_id: str,
    request: MoveConversationRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Moves a conversation into a specified folder or unfiles it in MongoDB.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not connected",
        )

    session = verify_clerk_session(authorization, x_user_id)
    user_id = session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to organize conversations",
        )

    convs_col = db["conversations"]

    update_payload = {"$set": {"updated_at": time.time()}}
    if request.folder_id:
        update_payload["$set"]["folder_id"] = request.folder_id
    else:
        update_payload["$unset"] = {"folder_id": ""}

    res = convs_col.update_one(
        {"id": conversation_id, "user_id": user_id},
        update_payload,
    )

    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    return {
        "status": "success",
        "conversation_id": conversation_id,
        "folder_id": request.folder_id,
    }
