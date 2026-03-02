from redis import Redis
from rq import Worker

from app.config import settings


if __name__ == "__main__":
    redis = Redis.from_url(settings.redis_url)
    worker = Worker([settings.rq_queue_name], connection=redis)
    worker.work(with_scheduler=True)
