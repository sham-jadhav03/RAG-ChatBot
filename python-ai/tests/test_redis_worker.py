import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

for key, value in {
    "REDIS_URL": "redis://localhost:6379",
    "MONGO_URI": "mongodb://localhost:27017/test",
    "NVIDIA_API_KEY": "test-nvidia-key",
    "GOOGLE_API_KEY": "test-google-key",
}.items():
    os.environ.setdefault(key, value)

from app.redis import redis_worker


class RedisWorkerReliabilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_connect_uses_no_read_timeout_for_pubsub_client(self):
        stream_client = AsyncMock()
        pubsub_client = AsyncMock()
        publisher = AsyncMock()

        with patch.object(
            redis_worker.redis,
            "from_url",
            new=AsyncMock(side_effect=[stream_client, pubsub_client, publisher]),
        ) as from_url:
            worker = redis_worker.RedisWorker()
            await worker.connect()

        self.assertEqual(from_url.call_count, 3)
        stream_kwargs = from_url.call_args_list[0].kwargs
        pubsub_kwargs = from_url.call_args_list[1].kwargs
        self.assertEqual(stream_kwargs["socket_timeout"], redis_worker._REDIS_SOCKET_TIMEOUT)
        self.assertIsNone(pubsub_kwargs["socket_timeout"])
        self.assertEqual(
            pubsub_kwargs["socket_connect_timeout"],
            redis_worker._REDIS_SOCKET_CONNECT_TIMEOUT,
        )
        pubsub_client.ping.assert_awaited_once()

    async def test_subscribe_uses_dedicated_pubsub_client(self):
        pubsub = AsyncMock()
        pubsub_client = MagicMock()
        pubsub_client.pubsub.return_value = pubsub

        worker = redis_worker.RedisWorker()
        worker.pubsub_client = pubsub_client
        worker._ensure_chat_consumer_group = AsyncMock()

        await worker.subscribe_to_channels()

        pubsub_client.pubsub.assert_called_once_with()
        pubsub.subscribe.assert_awaited_once_with(*worker.SUBSCRIBE_CHANNELS)
        self.assertIs(worker.pubsub, pubsub)

    async def test_claim_stale_messages_reuses_processing_path(self):
        worker = redis_worker.RedisWorker()
        worker.redis_client = AsyncMock()
        worker.redis_client.xautoclaim = AsyncMock(
            return_value=(
                "0-0",
                [("1-0", {"type": "ask_question", "requestId": "request-1"})],
                [],
            )
        )
        worker._process_chat_stream_message = AsyncMock()

        await worker._claim_stale_chat_messages()

        worker.redis_client.xautoclaim.assert_awaited_once_with(
            redis_worker.CHAT_STREAM_KEY,
            redis_worker.CHAT_CONSUMER_GROUP,
            worker._chat_stream_consumer_name,
            min_idle_time=redis_worker._CHAT_PENDING_MIN_IDLE_MS,
            start_id="0-0",
            count=10,
        )
        worker._process_chat_stream_message.assert_awaited_once_with(
            "1-0", {"type": "ask_question", "requestId": "request-1"}
        )

    async def test_processing_path_acknowledges_after_route(self):
        worker = redis_worker.RedisWorker()
        worker.redis_client = AsyncMock()
        worker.route_message = AsyncMock()

        await worker._process_chat_stream_message(
            "1-0", {"type": "ask_question", "requestId": "request-1"}
        )

        worker.route_message.assert_awaited_once_with(
            "pdf_chat_requests", {"type": "ask_question", "requestId": "request-1"}
        )
        worker.redis_client.xack.assert_awaited_once_with(
            redis_worker.CHAT_STREAM_KEY,
            redis_worker.CHAT_CONSUMER_GROUP,
            "1-0",
        )


if __name__ == "__main__":
    unittest.main()
