"""JWT authentication — shared secret with auth/finance services."""

from __future__ import annotations

import jwt
from fastapi import Header, HTTPException

from .config import settings


def verify_token(authorization: str = Header(...)) -> str:
    """FastAPI dependency: extract and verify Bearer token, return userId (sub)."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization[len("bearer "):]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject")
    return sub


def extract_raw_token(authorization: str) -> str:
    """Pull the raw JWT string from an Authorization header value."""
    if authorization.lower().startswith("bearer "):
        return authorization[len("bearer "):]
    return authorization
