from __future__ import annotations

import json
import shutil
import traceback
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

from redis import Redis

from app.config import settings
from app.models import Artifact, JobStatus, OutputFormat, PosterRequest
from app.redis_client import get_redis
from app.render import build_file_name, render_poster
from app.state import update_job_state
from app.storage import get_s3_client, upload_file
from app.themes import theme_ids

_CONTENT_TYPE_BY_FORMAT = {
    OutputFormat.png: "image/png",
    OutputFormat.svg: "image/svg+xml",
    OutputFormat.pdf: "application/pdf",
}


def _active_key(ip: str) -> str:
    return f"ratelimit:active:{ip}"


def _artifact_key(job_id: str, file_name: str) -> str:
    return f"jobs/{job_id}/{file_name}"


def run_generation_job(job_id: str, payload_dict: dict, client_ip: str) -> None:
    redis = get_redis()
    s3 = get_s3_client()

    payload = PosterRequest.model_validate(payload_dict)
    themes = sorted(theme_ids()) if payload.allThemes else [payload.theme]

    artifacts: list[Artifact] = []

    try:
        update_job_state(
            redis,
            job_id,
            ttl_seconds=settings.artifact_ttl_seconds,
            status=JobStatus.downloading,
            progress=5,
            step="Downloading map data",
        )

        with TemporaryDirectory(prefix=f"job-{job_id}-") as tmp:
            tmp_path = Path(tmp)

            total = len(themes)
            for idx, theme_name in enumerate(themes, start=1):
                progress = int(5 + (idx - 1) / max(total, 1) * 80)
                update_job_state(
                    redis,
                    job_id,
                    ttl_seconds=settings.artifact_ttl_seconds,
                    status=JobStatus.rendering,
                    progress=progress,
                    step=f"Rendering {theme_name} ({idx}/{total})",
                )

                file_name = build_file_name(payload, theme_name, payload.format)
                output_path = tmp_path / file_name
                render_poster(
                    payload,
                    theme_name=theme_name,
                    output_path=output_path,
                    output_format=payload.format,
                )

                key = _artifact_key(job_id, file_name)
                upload_file(
                    s3,
                    settings.s3_bucket_artifacts,
                    key,
                    output_path,
                    _CONTENT_TYPE_BY_FORMAT[payload.format],
                )
                artifacts.append(
                    Artifact(
                        theme=theme_name,
                        format=payload.format,
                        fileName=file_name,
                        key=key,
                    )
                )

            zip_key = None
            if len(artifacts) > 1:
                update_job_state(
                    redis,
                    job_id,
                    ttl_seconds=settings.artifact_ttl_seconds,
                    status=JobStatus.packaging,
                    progress=90,
                    step="Packaging ZIP archive",
                )
                zip_name = f"{payload.city.strip().lower().replace(' ', '_')}_{job_id}.zip"
                zip_path = tmp_path / zip_name
                with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
                    for artifact in artifacts:
                        source_path = tmp_path / artifact.fileName
                        if source_path.exists():
                            zipf.write(source_path, arcname=artifact.fileName)

                zip_key = _artifact_key(job_id, zip_name)
                upload_file(
                    s3,
                    settings.s3_bucket_artifacts,
                    zip_key,
                    zip_path,
                    "application/zip",
                )

            update_job_state(
                redis,
                job_id,
                ttl_seconds=settings.artifact_ttl_seconds,
                status=JobStatus.complete,
                progress=100,
                step="Completed",
                artifacts=artifacts,
                zip_key=zip_key,
            )
    except Exception as exc:  # noqa: BLE001
        update_job_state(
            redis,
            job_id,
            ttl_seconds=settings.artifact_ttl_seconds,
            status=JobStatus.failed,
            progress=100,
            step="Failed",
            error=f"{exc}\n{traceback.format_exc()}",
        )
        raise
    finally:
        redis.srem(_active_key(client_ip), job_id)
