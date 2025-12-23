# backend/app/auth.py
from __future__ import annotations

import os
from typing import Optional, Tuple, Dict, Any

import httpx
from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv()


def _get_supabase_env() -> Tuple[str, str]:
    supabase_url = os.getenv("SUPABASE_URL")

    api_key = (
        os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )

    if not supabase_url or not api_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "Server misconfigured: SUPABASE_URL and one of "
                "[SUPABASE_ANON_KEY | SUPABASE_SERVICE_ROLE_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY] must be set"
            ),
        )

    return supabase_url, api_key


async def _fetch_supabase_user(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization must be Bearer token")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty Bearer token")

    supabase_url, api_key = _get_supabase_env()
    url = f"{supabase_url.rstrip('/')}/auth/v1/user"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}", "apikey": api_key},
            )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Failed to reach Supabase Auth service")

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid/expired token")

    data = r.json()
    if not data.get("id"):
        raise HTTPException(status_code=401, detail="User id not found in token")
    return data


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    يرجع dict فيه id + email ... الخ
    """
    return await _fetch_supabase_user(authorization)


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """
    للحفاظ على التوافق مع بقية الراوترات: يرجع UUID فقط.
    """
    data = await _fetch_supabase_user(authorization)
    return data["id"]
