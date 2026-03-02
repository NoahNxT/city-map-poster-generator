from redis import Redis
from rq import Queue

from app.config import settings


def get_queue(redis: Redis) -> Queue:
    return Queue(name=settings.rq_queue_name, connection=redis, default_timeout=60 * 5)
