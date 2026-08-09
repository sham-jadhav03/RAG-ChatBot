import json
import logging
import redis.asyncio as redis
from typing import Dict, Any

from config import config

logger = logging.getLogger(__name__)

class RedisWorker:
    """Manages Redis Pub/Sub connection and message routing"""

    def __init__(self):
        self.redis_client = None
        self.pubsub = None
        self.publisher = None

    async def connect(self):
        """Establish Redis connection"""
        try:
            self.redis_client = await redis.from_url(
                config.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )

            # Test connection
            await self.redis_client.ping()
            logger.info(f"Connected to Redis: {config.REDIS_URL}")
        except Exception:
            logger.exception("Failed to connect to Redis")
            raise
             