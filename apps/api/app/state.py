import json
from datetime import datetime, timezone

from redis import Redis

from app.models import Artifact, JobState, JobStatus


def _job_key(job_id: str) -> str:
    return f"job:{job_id}"


def get_job_state(redis: Redis, job_id: str) -> JobState | None:
    raw = redis.get(_job_key(job_id))
    if not raw or not isinstance(raw, str):
        return None
    payload = json.loads(raw)
    return JobState.model_validate(payload)


def save_job_state(redis: Redis, state: JobState, ttl_seconds: int) -> None:
    redis.setex(_job_key(state.jobId), ttl_seconds, state.model_dump_json())


def update_job_state(
    redis: Redis,
    job_id: str,
    *,
    ttl_seconds: int,
    status: JobStatus | None = None,
    progress: int | None = None,
    step: str | None = None,
    artifacts: list[Artifact] | None = None,
    zip_key: str | None = None,
    error: str | None = None,
) -> JobState:
    state = get_job_state(redis, job_id)
    if state is None:
        state = JobState.new(job_id)

    if status is not None:
        state.status = status
    if progress is not None:
        state.progress = progress
    if step:
        state.steps.append(step)
    if artifacts is not None:
        state.artifacts = artifacts
    if zip_key is not None:
        state.zipKey = zip_key
    if error is not None:
        state.error = error

    state.updatedAt = datetime.now(timezone.utc).isoformat()
    save_job_state(redis, state, ttl_seconds)
    return state
