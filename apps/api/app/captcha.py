from __future__ import annotations

import httpx
from fastapi import HTTPException, status

from app.config import settings


async def verify_turnstile(token: str | None, remote_ip: str | None) -> None:
    if not settings.captcha_required:
        return

    if not settings.turnstile_secret_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CAPTCHA is enabled but TURNSTILE_SECRET_KEY is missing",
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="captchaToken is required",
        )

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            settings.turnstile_verify_url,
            data={
                "secret": settings.turnstile_secret_key,
                "response": token,
                "remoteip": remote_ip or "",
            },
        )

    payload = response.json()
    if not payload.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification failed",
        )
