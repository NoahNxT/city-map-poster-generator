from redis import Redis

from app.config import settings


def get_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)
