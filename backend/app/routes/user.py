from typing import Any, Dict, Optional
import time
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.db import get_db
from app.routes.auth import verify_clerk_session

router = APIRouter(prefix="/user", tags=["User Profile & Preferences"])


class UserProfileSyncRequest(BaseModel):
    user_id: Optional[str] = Field(default=None, description="Clerk or system user ID")
    email: Optional[str] = Field(default=None, description="Primary email address")
    first_name: Optional[str] = Field(default=None, description="First name")
    last_name: Optional[str] = Field(default=None, description="Last name")
    full_name: Optional[str] = Field(default=None, description="Full display name")
    image_url: Optional[str] = Field(default=None, description="Avatar image URL")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional user metadata")


class UserPreferencesUpdateRequest(BaseModel):
    theme: Optional[str] = Field(default=None, description="Theme (light/dark)")
    accent_color: Optional[str] = Field(default=None, description="Accent color theme")
    custom_instructions_user: Optional[str] = Field(default=None, description="Custom user persona instructions")
    custom_instructions_style: Optional[str] = Field(default=None, description="Custom style instructions")
    voice: Optional[str] = Field(default=None, description="Preferred TTS voice")
    tts_speed: Optional[str] = Field(default=None, description="TTS speed multiplier")
    tts_auto: Optional[str] = Field(default=None, description="TTS auto-play (on/off)")
    show_code: Optional[bool] = Field(default=None, description="Show code/tool outputs")
    show_citations: Optional[bool] = Field(default=None, description="Show document citations")
    save_history: Optional[bool] = Field(default=None, description="Auto-save conversation history")


@router.get("/profile", summary="Get user profile and settings from MongoDB")
def get_user_profile(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Fetches the authenticated user's profile and preferences from MongoDB `users` collection.
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
            detail="Authentication required to access user profile",
        )

    users_col = db["users"]
    user_doc = users_col.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        # Return base profile if not synced yet
        return {
            "user_id": user_id,
            "email": session.get("email"),
            "full_name": "Authenticated User",
            "created_at": time.time(),
            "updated_at": time.time(),
            "preferences": {},
        }

    return user_doc


@router.post("/profile/sync", summary="Sync Clerk user profile data to MongoDB")
def sync_user_profile(
    request: UserProfileSyncRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Upserts Clerk user data (name, email, avatar, metadata) into MongoDB `users` collection upon sign-in.
    """
    db = get_db()
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB is not connected",
        )

    session = verify_clerk_session(authorization, x_user_id)
    user_id = session.get("user_id") or request.user_id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid user session or user_id required for syncing",
        )

    users_col = db["users"]
    now = time.time()

    display_name = request.full_name
    if not display_name:
        parts = [p for p in [request.first_name, request.last_name] if p]
        display_name = " ".join(parts) if parts else "Authenticated User"

    update_fields: Dict[str, Any] = {
        "user_id": user_id,
        "email": request.email or session.get("email"),
        "first_name": request.first_name,
        "last_name": request.last_name,
        "full_name": display_name,
        "image_url": request.image_url,
        "last_login_at": now,
        "updated_at": now,
    }
    if request.metadata:
        update_fields["metadata"] = request.metadata

    # Perform upsert so created_at is preserved
    users_col.update_one(
        {"user_id": user_id},
        {
            "$set": update_fields,
            "$setOnInsert": {"created_at": now, "preferences": {}},
        },
        upsert=True,
    )

    saved_user = users_col.find_one({"user_id": user_id}, {"_id": 0})
    return {"status": "success", "user": saved_user}


@router.put("/profile/preferences", summary="Update user preferences in MongoDB")
def update_user_preferences(
    request: UserPreferencesUpdateRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
):
    """
    Updates user settings and custom instructions in the MongoDB `users` collection.
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
            detail="Authentication required to update preferences",
        )

    users_col = db["users"]
    now = time.time()

    pref_updates = {}
    for key, value in request.model_dump(exclude_unset=True).items():
        if value is not None:
            pref_updates[f"preferences.{key}"] = value

    if not pref_updates:
        return {"status": "no_changes"}

    pref_updates["updated_at"] = now

    users_col.update_one(
        {"user_id": user_id},
        {
            "$set": pref_updates,
            "$setOnInsert": {"created_at": now, "user_id": user_id},
        },
        upsert=True,
    )

    saved_user = users_col.find_one({"user_id": user_id}, {"_id": 0})
    return {"status": "success", "user": saved_user}
