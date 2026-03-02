from __future__ import annotations

from typing import cast

from fastapi import HTTPException, status
from redis import Redis


def check_window_limit(redis: Redis, *, key: str, limit: int, window_seconds: int) -> None:
    count = cast(int, redis.incr(key))
    if count == 1:
        redis.expire(key, window_seconds)
    if count > limit:
        ttl = cast(int, redis.ttl(key))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Retry in {max(ttl, 1)} seconds.",
        )


def check_concurrency_limit(redis: Redis, *, key: str, limit: int) -> None:
    count = cast(int, redis.scard(key))
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many concurrent jobs from this IP. Try again after current jobs finish.",
        )
