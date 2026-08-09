import asyncio
import json
import logging
import redis.asyncio as redis
from typing import Dict, Any

from app.config import config

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

    async def subscribe_to_channels(self):
        """Subscribe to all required channels"""
        try:
            self.pubsub = self.redis_client.pubsub()

            channels = [
                "pdf_process_requests",
                "chat_requests",
            ]

            await self.pubsub.subscribe(*channels)
            logger.info(f"subscribed to channels: {channels}")

        except Exception as e:
            logger.error(f"Failed to subscribe to channels: {e}")
            raise

    async def publish_response(self, channel: str, message: Dict[str, Any]):
        """
            Publish a response message to a channel
            
            Args:
                channel: Redis channel name
                message: Message dict to publish
        """

        try:
            json_message = json.dumps(message)
            await self.publisher.publish(channel, json_message)
            logger.debug(f"Published to {channel}: {message.get('type', 'unknown')}")

        except Exception as e:
            logger.error(f"Failed to publish to {channel}: {e}")
            raise

    async def handle_pdf_process_request(self, payload: Dict[str, Any]):
        """
            Handle PDF processing request
            
            Args:
                payload: Message from pdf_process_requests channel
        """
        try:
            document_id = payload.get("documentId")
            file_path = payload.get("filePath")
            file_name = payload.get("fileName")

            logger.info(f"PDF process request: {document_id} - {file_name}")
            logger.debug(f" File path: {file_path}")

      # 8 - Replace with actual PDF processing pipeline
            # For now, just log and send success response
            response = {
                "type": "process_pdf_response",
                "documentId": document_id,
                "status": "completed",
                "chunksCreated": 0,
                "embeddingsGenerated": 0,
                "totalTokens": 0,
                "error": None,
                "timestamp": None  # Will be set in Phase 8
            }
            
            await self.publish_response("pdf_process_responses", response)
            logger.info(f"PDF response published for {document_id}")
            
        except Exception as e:
            logger.error(f"Error handling PDF request: {e}", exc_info=True)
            # Send error response
            await self.publish_response("pdf_process_responses", {
                "type": "process_pdf_response",
                "documentId": payload.get("documentId", "unknown"),
                "status": "failed",
                "chunksCreated": 0,
                "embeddingsGenerated": 0,
                "totalTokens": 0,
                "error": str(e),
                "timestamp": None
            })

    async def handle_chat_request(self, payload: Dict[str, Any]):
        """
        Handle chat/RAG request
        
        Args:
            payload: Message from chat_requests channel
        """
        try:
            request_id = payload.get("requestId")
            session_id = payload.get("sessionId")
            question = payload.get("question")
            
            logger.info(f"Chat Request: {request_id[:8]}... - {question[:50]}...")
            logger.debug(f"   Session: {session_id}")
            
            # Phase 9 - Replace with actual LangGraph workflow
            # For now, just log and send placeholder response
            response = {
                "type": "ask_question_response",
                "requestId": request_id,
                "answer": "Placeholder response - LangGraph not implemented yet",
                "sources": [],
                "suggestedQuestions": [],
                "error": None,
                "timestamp": None  # Will be set in Phase 9
            }
            
            await self.publish_response("chat_responses", response)
            logger.info(f"Chat response published for {request_id[:8]}...")
            
        except Exception as e:
            logger.error(f"Error handling chat request: {e}", exc_info=True)
            # Send error response
            await self.publish_response("chat_responses", {
                "type": "ask_question_response",
                "requestId": payload.get("requestId", "unknown"),
                "answer": None,
                "sources": [],
                "suggestedQuestions": [],
                "error": str(e),
                "timestamp": None
            })
 
    async def route_message(self, channel: str, payload: Dict[str, Any]):
        """
        Route incoming message to appropriate handler based on channel
        
        Args:
            channel: Redis channel name
            payload: Parsed JSON payload
        """
        message_type = payload.get("type")
        
        if channel == "pdf_process_requests" and message_type == "process_pdf":
            await self.handle_pdf_process_request(payload)
            
        elif channel == "chat_requests" and message_type == "ask_question":
            await self.handle_chat_request(payload)
            
        else:
            logger.warning(
                f"nknown message type '{message_type}' on channel '{channel}'"
            )
 
    async def listen_forever(self):
        """
        Main listener loop - continuously processes incoming messages
        Runs indefinitely until cancelled
        """
        await self.connect()
        await self.subscribe_to_channels()
        
        logger.info("🎧 Redis worker listening for messages...")
        
        try:
            async for message in self.pubsub.listen():
                # Skip subscription confirmation messages
                if message["type"] == "subscribe":
                    logger.debug(f"Subscribed to {message['channel']}")
                    continue
                
                # Skip unsubscribe messages
                if message["type"] == "unsubscribe":
                    continue
                
                # Process actual message
                if message["type"] == "message":
                    channel = message["channel"]
                    data = message["data"]
                    
                    try:
                        payload = json.loads(data)
                        logger.debug(f"Message on {channel}: {payload.get('type', 'unknown')}")
                        await self.route_message(channel, payload)
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON from {channel}: {e}")
                        logger.error(f"Raw data: {data}")
                        
        except asyncio.CancelledError:
            logger.info("Redis worker listener cancelled")
            
        except Exception as e:
            logger.error(f"Redis listener error: {e}", exc_info=True)
            raise
            
        finally:
            await self.cleanup()
 
    async def cleanup(self):
        """Close Redis connections"""
        try:
            if self.pubsub:
                await self.pubsub.unsubscribe()
                await self.pubsub.close()
                logger.info("PubSub closed")
                
            if self.redis_client:
                await self.redis_client.close()
                logger.info("Redis client closed")
                
            if self.publisher:
                await self.publisher.close()
                logger.info("Redis publisher closed")
                
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
 
 
# Global worker instance
_worker = None
 
async def listen_to_redis():
    """
    Entry point for Redis worker
    Called from main.py on application startup
    """
    global _worker
    _worker = RedisWorker()
    await _worker.listen_forever()
