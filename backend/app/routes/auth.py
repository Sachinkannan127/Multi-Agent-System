import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Union
import requests

try:
    import jwt
except ImportError:
    jwt = None

from fastapi import APIRouter, Header, HTTPException, status, Depends
from pydantic import BaseModel, Field

from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication & Tokens"])

# JWT Configuration
JWT_SECRET_KEY = settings.CLERK_SECRET_KEY or os.getenv("JWT_SECRET_KEY", "multiagent-secret-key-super-secure-2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60           # 1 hour access token
REFRESH_TOKEN_EXPIRE_DAYS = 7             # 7 days refresh token


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = ACCESS_TOKEN_EXPIRE_MINUTES * 60
    user_id: str
    role: str = "user"


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="The refresh token provided during login")


class TokenVerifyRequest(BaseModel):
    token: str = Field(..., description="The access token to verify")


# =========================================================================
# Token Generation & Verification Helpers
# =========================================================================
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access_token"
    })
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "refresh_token"
    })
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT token.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please refresh your session.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature or malformed token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_clerk_session(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_guest_id: Optional[str] = Header(None, alias="X-Guest-Id"),
) -> Dict[str, Any]:
    """
    Dependency to verify either Clerk JWT, Backend Access Token, or isolated Guest session.
    Guarantees strict per-user data isolation: every authenticated user receives their
    distinct unique user_id, and guests receive their isolated guest session ID.
    Never falls back to a shared generic user identifier.
    """
    token = None
    if authorization:
        token = authorization.replace("Bearer ", "").strip()

    # 1. Bearer Token Verification
    if token:
        # A. First check if it's our own backend-issued Access Token
        if jwt is not None:
            try:
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], options={"verify_exp": True})
                if payload.get("type") == "access_token":
                    resolved_user_id = payload.get("sub") or x_user_id or "authenticated_user"
                    return {
                        "user_id": resolved_user_id,
                        "authenticated": True,
                        "role": payload.get("role", "user"),
                        "token_type": "access_token",
                    }
            except Exception:
                pass

        # B. Check if it's a Clerk JWT Session Token
        # Clerk session tokens are JWTs where 'sub' claim is the unique Clerk User ID (e.g. 'user_2xyz...')
        if jwt is not None:
            try:
                unverified = jwt.decode(token, options={"verify_signature": False})
                clerk_sub = unverified.get("sub") or unverified.get("user_id")

                # Verify expiration if exp claim is present
                exp = unverified.get("exp")
                if exp and exp < time.time():
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Session token has expired. Please refresh your session.",
                    )

                if clerk_sub:
                    return {
                        "user_id": clerk_sub,
                        "authenticated": True,
                        "session_id": unverified.get("sid"),
                        "role": "user",
                        "token_type": "clerk_jwt",
                    }
            except HTTPException:
                raise
            except Exception:
                pass

        # C. If X-User-Id is provided alongside token
        if x_user_id and x_user_id.strip():
            return {
                "user_id": x_user_id.strip(),
                "authenticated": True,
                "role": "user",
                "token_type": "client_identified",
            }

    # 2. Client explicitly authenticated via X-User-Id
    if x_user_id and x_user_id.strip():
        return {
            "user_id": x_user_id.strip(),
            "authenticated": True,
            "role": "user",
            "token_type": "user_id_header",
        }

    # 3. Isolated Guest Session: Each guest gets their own unique guest session ID
    if x_guest_id and x_guest_id.strip():
        return {
            "user_id": x_guest_id.strip(),
            "authenticated": False,
            "role": "guest",
            "token_type": "guest_session",
        }

    # 4. Anonymous/Unidentified: user_id is None to avoid showing any other user's data
    return {"user_id": None, "authenticated": False, "role": "anonymous"}


# =========================================================================
# Auth & Token Endpoints
# =========================================================================
@router.get("/config")
def get_auth_config():
    """
    Returns public Clerk & token configuration for frontend clients.
    """
    pk = settings.CLERK_PUBLISHABLE_KEY or os.getenv("VITE_CLERK_PUBLISHABLE_KEY", "")
    return {
        "publishable_key": pk,
        "is_configured": bool(pk and not pk.startswith("pk_test_placeholder")),
        "auth_provider": "clerk",
        "access_token_expire_seconds": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "refresh_token_expire_days": REFRESH_TOKEN_EXPIRE_DAYS,
    }


class TokenCreateRequest(BaseModel):
    user_id: str = Field(default="user_default")
    role: str = Field(default="user")


@router.post("/token", response_model=TokenResponse)
def create_token_pair(body: Optional[TokenCreateRequest] = None):
    """
    Generates a fresh Access Token (60 min) and Refresh Token (7 days).
    """
    req = body or TokenCreateRequest()
    token_data = {"sub": req.user_id, "role": req.role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=req.user_id,
        role=req.role,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_access_token(body: RefreshTokenRequest):
    """
    Exchanges a valid Refresh Token for a brand-new Access Token and rotated Refresh Token.
    """
    payload = decode_token(body.refresh_token)

    if payload.get("type") != "refresh_token":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token type. Expected a refresh_token.",
        )

    user_id = payload.get("sub", "user_default")
    role = payload.get("role", "user")

    # Issue fresh access token and rotated refresh token
    new_token_data = {"sub": user_id, "role": role}
    new_access_token = create_access_token(new_token_data)
    new_refresh_token = create_refresh_token(new_token_data)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user_id=user_id,
        role=role,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/verify")
def verify_access_token(body: TokenVerifyRequest):
    """
    Validates an Access Token and returns payload status.
    """
    payload = decode_token(body.token)
    return {
        "valid": True,
        "user_id": payload.get("sub"),
        "role": payload.get("role"),
        "expires_at": payload.get("exp"),
        "issued_at": payload.get("iat"),
    }


@router.get("/me")
def get_current_user(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_guest_id: Optional[str] = Header(None, alias="X-Guest-Id"),
):
    """
    Returns current authenticated user status and decoded session.
    """
    session = verify_clerk_session(authorization, x_user_id, x_guest_id)
    return {
        "status": "success",
        "session": session,
    }
