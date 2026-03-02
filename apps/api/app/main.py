from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.captcha import verify_turnstile
from app.config import settings
from app.font_search import search_fonts
from app.location_search import search_locations
from app.models import JobStatus, OutputFormat, PosterRequest
from app.queueing import get_queue
from app.rate_limit import check_concurrency_limit, check_window_limit
from app.redis_client import get_redis
from app.state import get_job_state
from app.storage import (
    configure_lifecycle,
    ensure_buckets,
    get_s3_client,
    object_exists,
    signed_url,
    upload_file,
)
from app.themes import load_themes, theme_ids

app = FastAPI(title=settings.app_name)
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateJobRequest(BaseModel):
    payload: PosterRequest
    captchaToken: str | None = None


def _should_bypass_preview_rate_limit(request: Request) -> bool:
    if settings.app_env.strip().lower() == "production":
        return False
    header = request.headers.get("x-dev-preview-no-rate-limit", "").strip().lower()
    return header in {"1", "true", "yes", "on"}


def _preview_payload(payload: PosterRequest) -> PosterRequest:
    return payload.model_copy(
        update={
            "format": OutputFormat.png,
            "allThemes": False,
        }
    )


@app.on_event("startup")
def startup() -> None:
    try:
        s3 = get_s3_client()
        ensure_buckets(s3)
        configure_lifecycle(s3)
    except Exception as exc:  # noqa: BLE001
        logger.warning("S3 bootstrap skipped during startup: %s", exc)


@app.get("/health")
def health() -> dict:
    redis = get_redis()
    redis.ping()
    return {
        "status": "ok",
        "service": "api",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/v1/themes")
def get_themes() -> dict:
    return {"themes": [theme.model_dump() for theme in load_themes()]}


@app.get("/v1/locations")
async def get_locations(request: Request, q: str, limit: int = 8) -> dict:
    query = q.strip()
    if len(query) < 2:
        return {"suggestions": []}

    redis = get_redis()
    ip = request.client.host if request.client else "unknown"
    check_window_limit(
        redis,
        key=f"ratelimit:locations:{ip}",
        limit=settings.rate_limit_locations_count,
        window_seconds=settings.rate_limit_locations_window_seconds,
    )

    suggestions = await search_locations(query, limit=limit)
    return {"suggestions": [suggestion.model_dump() for suggestion in suggestions]}


@app.get("/v1/fonts")
async def get_fonts(request: Request, q: str = "", limit: int = 12) -> dict:
    redis = get_redis()
    ip = request.client.host if request.client else "unknown"
    check_window_limit(
        redis,
        key=f"ratelimit:fonts:{ip}",
        limit=settings.rate_limit_fonts_count,
        window_seconds=settings.rate_limit_fonts_window_seconds,
    )

    suggestions = await search_fonts(q, limit=limit)
    return {"suggestions": [suggestion.model_dump() for suggestion in suggestions]}


@app.post("/v1/preview")
async def preview(request: Request, payload: PosterRequest) -> dict:
    from app.render import preview_cache_key, render_poster

    redis = get_redis()
    ip = request.client.host if request.client else "unknown"

    bypass_preview_rate_limit = _should_bypass_preview_rate_limit(request)
    if not bypass_preview_rate_limit:
        check_window_limit(
            redis,
            key=f"ratelimit:preview:{ip}",
            limit=settings.rate_limit_preview_count,
            window_seconds=settings.rate_limit_preview_window_seconds,
        )

    if payload.theme not in theme_ids():
        raise HTTPException(status_code=400, detail=f"Unknown theme: {payload.theme}")

    payload = _preview_payload(payload)

    key = preview_cache_key(payload)
    cached_raw = redis.get(key)
    cached = cached_raw if isinstance(cached_raw, str) else None

    s3 = get_s3_client()
    if cached and object_exists(s3, settings.s3_bucket_previews, cached):
        return {
            "previewUrl": signed_url(
                s3, settings.s3_bucket_previews, cached, settings.presigned_url_ttl_seconds
            ),
            "cacheHit": True,
            "expiresAt": (
                datetime.now(timezone.utc) + timedelta(seconds=settings.preview_ttl_seconds)
            ).isoformat(),
        }

    out_dir = Path("/tmp/previews")
    out_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{uuid4()}.png"
    output_path = out_dir / file_name
    try:
        await run_in_threadpool(
            render_poster,
            payload,
            theme_name=payload.theme,
            output_path=output_path,
            output_format=OutputFormat.png,
            raster_dpi=settings.preview_raster_dpi,
            network_type=settings.preview_network_type,
            include_water=settings.preview_include_water,
            include_parks=settings.preview_include_parks,
            include_labels=False,
            include_attribution=False,
        )
        await run_in_threadpool(
            upload_file,
            s3,
            settings.s3_bucket_previews,
            f"preview/{key}.png",
            output_path,
            "image/png",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Preview rendering failed")
        raise HTTPException(status_code=500, detail=f"Preview render failed: {exc}") from exc

    object_key = f"preview/{key}.png"
    redis.setex(key, settings.preview_ttl_seconds, object_key)

    return {
        "previewUrl": signed_url(
            s3, settings.s3_bucket_previews, object_key, settings.presigned_url_ttl_seconds
        ),
        "cacheHit": False,
        "expiresAt": (
            datetime.now(timezone.utc) + timedelta(seconds=settings.preview_ttl_seconds)
        ).isoformat(),
    }


@app.post("/v1/jobs")
async def create_job(request: Request, body: CreateJobRequest) -> dict:
    from app.jobs import run_generation_job

    payload = body.payload
    redis = get_redis()
    ip = request.client.host if request.client else "unknown"

    check_window_limit(
        redis,
        key=f"ratelimit:jobs:{ip}",
        limit=settings.rate_limit_jobs_count,
        window_seconds=settings.rate_limit_jobs_window_seconds,
    )
    check_concurrency_limit(
        redis,
        key=f"ratelimit:active:{ip}",
        limit=settings.rate_limit_max_concurrent_jobs_per_ip,
    )

    if payload.theme not in theme_ids() and not payload.allThemes:
        raise HTTPException(status_code=400, detail=f"Unknown theme: {payload.theme}")

    await verify_turnstile(body.captchaToken, ip)

    job_id = str(uuid4())
    state = {
        "jobId": job_id,
        "status": JobStatus.queued.value,
        "progress": 0,
        "steps": ["Queued"],
        "artifacts": [],
        "error": None,
        "zipKey": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    redis.setex(f"job:{job_id}", settings.artifact_ttl_seconds, json.dumps(state))
    redis.sadd(f"ratelimit:active:{ip}", job_id)

    queue = get_queue(redis)
    queue.enqueue(
        run_generation_job,
        job_id,
        payload.model_dump(mode="json"),
        ip,
        job_id=job_id,
        result_ttl=settings.artifact_ttl_seconds,
    )

    return {
        "jobId": job_id,
        "status": JobStatus.queued.value,
        "createdAt": state["createdAt"],
    }


@app.get("/v1/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    redis = get_redis()
    state = get_job_state(redis, job_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return state.model_dump()


@app.get("/v1/jobs/{job_id}/download")
def job_download(job_id: str) -> dict:
    redis = get_redis()
    state = get_job_state(redis, job_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if state.status != JobStatus.complete:
        raise HTTPException(status_code=409, detail="Job is not complete")

    s3 = get_s3_client()

    if state.zipKey:
        key = state.zipKey
    elif len(state.artifacts) == 1:
        key = state.artifacts[0].key
    else:
        raise HTTPException(status_code=409, detail="No downloadable artifact available")

    return {
        "url": signed_url(s3, settings.s3_bucket_artifacts, key, settings.presigned_url_ttl_seconds),
        "expiresAt": (
            datetime.now(timezone.utc) + timedelta(seconds=settings.presigned_url_ttl_seconds)
        ).isoformat(),
    }
