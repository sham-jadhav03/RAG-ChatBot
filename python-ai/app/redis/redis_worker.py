import asyncio
import json
import logging
import redis.asyncio as redis
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError
from typing import Dict, Any

from app.config import config

logger = logging.getLogger(__name__)

# Reconnect backoff configuration
_INITIAL_BACKOFF_S = 1.0
_MAX_BACKOFF_S = 60.0
_BACKOFF_FACTOR = 2.0

# Redis socket configuration for long-lived Pub/Sub connections
_REDIS_SOCKET_TIMEOUT = 30.0         # read timeout (seconds)
_REDIS_SOCKET_CONNECT_TIMEOUT = 10.0 # connect timeout (seconds)
_REDIS_HEALTH_CHECK_INTERVAL = 15    # keepalive ping interval (seconds)


class RedisWorker:
    """Manages Redis Pub/Sub connection and message routing with auto-reconnect"""

    # Canonical channel names — must match Node.js channels.ts
    SUBSCRIBE_CHANNELS = [
        "pdf_process_requests",
        "pdf_chat_requests",
    ]

    def __init__(self):
        self.redis_client = None
        self.pubsub = None
        self.publisher = None
        self._active_tasks = set()

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self):
        """Establish Redis subscriber and publisher connections"""
        try:
            self.redis_client = await redis.from_url(
                config.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=_REDIS_SOCKET_TIMEOUT,
                socket_connect_timeout=_REDIS_SOCKET_CONNECT_TIMEOUT,
                health_check_interval=_REDIS_HEALTH_CHECK_INTERVAL,
            )

            # Test connection
            await self.redis_client.ping()
            logger.info(f"Connected to Redis: {config.REDIS_URL}")

            # Separate client for publishing (Pub/Sub client cannot publish)
            self.publisher = await redis.from_url(
                config.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=_REDIS_SOCKET_TIMEOUT,
                socket_connect_timeout=_REDIS_SOCKET_CONNECT_TIMEOUT,
            )
            logger.info("Redis publisher initialized")

        except Exception as e:
            logger.exception(f"Failed to connect to Redis: {e}")
            raise

    async def subscribe_to_channels(self):
        """Subscribe to all required channels"""
        try:
            self.pubsub = self.redis_client.pubsub()
            await self.pubsub.subscribe(*self.SUBSCRIBE_CHANNELS)
            logger.info(f"Subscribed to channels: {self.SUBSCRIBE_CHANNELS}")
        except Exception as e:
            logger.error(f"Failed to subscribe to channels: {e}")
            raise

    async def _close_silently(self):
        """
        Close all Redis connections silently.
        Used before reconnect — errors are logged but not raised.
        """
        for name, obj in [("pubsub", self.pubsub), ("redis_client", self.redis_client), ("publisher", self.publisher)]:
            if obj is None:
                continue
            try:
                if name == "pubsub":
                    await obj.unsubscribe()
                await obj.close()
            except Exception as e:
                logger.debug(f"Ignored error closing {name}: {e}")
        self.pubsub = None
        self.redis_client = None
        self.publisher = None

    async def cleanup(self):
        """Close Redis connections and cancel in-flight tasks (used for graceful shutdown)"""
        try:
            if self._active_tasks:
                for task in list(self._active_tasks):
                    task.cancel()
                await asyncio.gather(*self._active_tasks, return_exceptions=True)
                self._active_tasks.clear()

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

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Message handlers
    # ------------------------------------------------------------------

    async def handle_pdf_process_request(self, payload: Dict[str, Any]):
        """
            Handle PDF processing request
            
            Args:
                payload: Message from pdf_process_requests channel
        """
        document_id = payload.get("documentId")
        file_path = payload.get("filePath")
        file_name = payload.get("fileName")

        logger.info(f"PDF process request: {document_id} - {file_name}")

        try:
            # Import here to avoid circular dependencies
            from app.ingestion.pdf_processor import get_processor
            from app.ingestion.embedder import get_embedder
            from app.vector.chroma_client import get_vector_store
            from app.db.mongo_client import get_mongo_client
            from datetime import datetime

            # Get service instances
            pdf_processor = get_processor(
                chunk_size=config.CHUNK_SIZE,
                chunk_overlap=config.CHUNK_OVERLAP,
            )
            embedder = get_embedder()
            vectore_store = get_vector_store(path=config.CHROMA_PATH)
            mongo_client = get_mongo_client()

            # Step 0: Set MongoDB status to PROCESSING
            logger.info("Step 0/4: Setting status to PROCESSING...")
            await mongo_client.update_processing_status(document_id, "PROCESSING")

            # Step 1: Load and chunk PDF
            logger.info("step: 1/4: Loading and chunking pdf...")
            chunks, token_count = await pdf_processor.process_pdf(file_path, original_filename=file_name)

            if not chunks:
                raise ValueError("No chunks extracted from pdf")

            # step 2: Generate embeddings
            logger.info("step 2/4: Generating embedding...")
            embeddings, chunks = await embedder.embed_documents(chunks)

            if not embeddings:
                raise ValueError("No embeddings generated")

             # Step 3: Store in Chroma
            logger.info("Step 3/4: Storing in vector database...")
            storage_result = await vectore_store.store_embeddings(
                document_id=document_id,
                chunks=chunks,
                embeddings=embeddings
            )

            # Step 4: Update MongoDB status
            logger.info("Step 4/4: Updating MongoDB...")
            await mongo_client.mark_processing_complete(
                document_id=document_id,
                chunks_count=len(chunks),
                tokens_count=token_count,
            )

            # Send success response
            response = {
                "type": "process_pdf_response",
                "documentId": document_id,
                "status": "COMPLETED",
                "chunksCreated": len(chunks),
                "embeddingsGenerated": len(embeddings),
                "totalTokens": token_count,
                "errorMessage": None,
                "timestamp": datetime.utcnow().isoformat() + "Z",  
            }

            await self.publish_response("pdf_process_responses", response)
            logger.info(f"PDF response published for {document_id}")
            
        except FileNotFoundError as e:
            logger.error(f"PDF file not found: {e}")
            error_msg = f"PDF file not found: {file_path}"

            # update Mongo with error
            from app.db.mongo_client import get_mongo_client
            from datetime import datetime
            mongo_client = get_mongo_client()
            await mongo_client.mark_processing_failed(document_id, error_msg)

            # Send error response
            await self.publish_response("pdf_process_responses", {
                "type": "process_pdf_response",
                "documentId": document_id,
                "status": "FAILED",
                "chunksCreated": 0,
                "embeddingsGenerated": 0,
                "totalTokens": 0,
                "errorMessage": error_msg,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })

        except ValueError as e:
            logger.error(f"Validation error: {e}")
            error_msg = str(e)
            
            # Update MongoDB
            from app.db.mongo_client import get_mongo_client
            from datetime import datetime
            mongo_client = get_mongo_client()
            await mongo_client.mark_processing_failed(document_id, error_msg)
            
            # Send error response
            await self.publish_response("pdf_process_responses", {
                "type": "process_pdf_response",
                "documentId": document_id,
                "status": "FAILED",
                "chunksCreated": 0,
                "embeddingsGenerated": 0,
                "totalTokens": 0,
                "errorMessage": error_msg,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
            
        except Exception as e:
            logger.error(f"Unexpected error processing PDF: {e}", exc_info=True)
            error_msg = f"Unexpected error: {str(e)}"
            
            # Update MongoDB
            try:
                from app.db.mongo_client import get_mongo_client
                mongo_client = get_mongo_client()
                await mongo_client.mark_processing_failed(document_id, error_msg)
            except:
                logger.warning("Could not update MongoDB with error")
            
            # Send error response
            from datetime import datetime
            await self.publish_response("pdf_process_responses", {
                "type": "process_pdf_response",
                "documentId": document_id,
                "status": "FAILED",
                "chunksCreated": 0,
                "embeddingsGenerated": 0,
                "totalTokens": 0,
                "errorMessage": error_msg,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })

    async def handle_chat_request(self, payload: Dict[str, Any]):
        """
        Handle chat/RAG request
        Args:
            payload: Message from pdf_chat_requests channel
        """
        request_id = None
        session_id = None
        document_id = None
        question = None
        conversation_history = []

        try:
            request_id = payload.get("requestId")
            session_id = payload.get("sessionId")
            document_id = payload.get("documentId") or ""
            question = payload.get("question")
            conversation_history = payload.get("conversationHistory", [])
            
            logger.info(
                f"Chat Request: {request_id[:8] if request_id else 'none'}... - "
                f"doc: {document_id} - {question[:50] if question else ''}..."
            )
            logger.debug(f"   Session: {session_id}")
            logger.info(f"Conversation history: {len(conversation_history)} entries")
            logger.info(f"Conversation history: {conversation_history}")

            try:
                # Import LangGraph
                from app.graph.build_graph import invoke_rag_graph
                from datetime import datetime

                # Invoke RAG workflow
                logger.info("Step 1/3: Retrieving context...")
                logger.info("Step 2/3: Generating answer...")
                logger.info("Step 3/3: Generating suggestions...")

                final_state = await invoke_rag_graph(
                    question=question,
                    session_id=session_id,
                    history=conversation_history,
                    document_id=document_id,
                )

                # Check for errors
                if final_state.error:
                    raise ValueError(final_state.error)

                # Format response
                response = {
                    "type": "ask_question_response",
                    "requestId": request_id,
                    "answer": final_state.answer,
                    "sources": final_state.sources,
                    "suggestedQuestions": final_state.suggested_questions,
                    "error": None,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }

                await self.publish_response("pdf_chat_responses", response)
                logger.info(f"Chat response published for {request_id[:8] if request_id else 'none'}...")

            except ValueError as e:
                logger.error(f"Validation error: {e}")
                from datetime import datetime
                await self.publish_response("pdf_chat_responses", {
                    "type": "ask_question_response",
                    "requestId": request_id,
                    "answer": None,
                    "sources": [],
                    "suggestedQuestions": [],
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                })

        except Exception as e:
            logger.error(f"Error handling chat request: {e}", exc_info=True)
            # Send error response
            from datetime import datetime
            await self.publish_response("pdf_chat_responses", {
                "type": "ask_question_response",
                "requestId": request_id,
                "answer": None,
                "sources": [],
                "suggestedQuestions": [],
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
 
    def _dispatch_message(self, channel: str, payload: Dict[str, Any]):
        """
        Dispatch message processing to a concurrent background task.
        Prevents slow LLM or PDF ingestion calls from blocking the Redis listener loop.
        """
        task = asyncio.create_task(self._safe_route_message(channel, payload))
        self._active_tasks.add(task)
        task.add_done_callback(self._active_tasks.discard)

    async def _safe_route_message(self, channel: str, payload: Dict[str, Any]):
        """Safely route and handle a message in the background, logging any unhandled errors."""
        try:
            await self.route_message(channel, payload)
        except asyncio.CancelledError:
            # Propagate cancellation for graceful shutdown
            raise
        except Exception as e:
            logger.error(
                f"Error processing background message on {channel}: {e}",
                exc_info=True,
            )

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
            
        elif channel == "pdf_chat_requests" and message_type == "ask_question":
            await self.handle_chat_request(payload)
            
        else:
            logger.warning(
                f"Unknown message type '{message_type}' on channel '{channel}'"
            )

    # ------------------------------------------------------------------
    # Main listener with reconnect
    # ------------------------------------------------------------------

    async def listen_forever(self):
        """
        Main listener loop with automatic reconnection.

        On Redis connection loss the worker:
        1. Closes all broken connections silently.
        2. Waits with bounded exponential backoff (1 s → 60 s).
        3. Re-creates Redis client, publisher, and Pub/Sub subscription.
        4. Resumes listening.

        The loop exits only on asyncio.CancelledError (graceful shutdown).
        """
        backoff = _INITIAL_BACKOFF_S

        while True:
            try:
                # --- (Re)connect ---
                await self.connect()
                await self.subscribe_to_channels()
                logger.info("🎧 Redis worker listening for messages...")
                backoff = _INITIAL_BACKOFF_S  # reset after successful connect

                # --- Listen ---
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
                            self._dispatch_message(channel, payload)
                        except json.JSONDecodeError as e:
                            logger.error(f"Invalid JSON from {channel}: {e}")
                            logger.error(f"Raw data: {data}")

            except asyncio.CancelledError:
                logger.info("Redis worker listener cancelled — shutting down")
                await self.cleanup()
                return

            except (RedisConnectionError, RedisTimeoutError, ConnectionError, OSError) as e:
                # --- Transient connection failure: reconnect ---
                logger.warning(f"Redis connection lost: {e}")
                await self._close_silently()
                logger.info(f"Reconnecting in {backoff:.1f}s …")
                await asyncio.sleep(backoff)
                backoff = min(backoff * _BACKOFF_FACTOR, _MAX_BACKOFF_S)

            except Exception as e:
                # Unexpected error — still attempt reconnect rather than die,
                # but log the full traceback so it can be investigated.
                logger.error(f"Unexpected Redis listener error: {e}", exc_info=True)
                await self._close_silently()
                logger.info(f"Reconnecting in {backoff:.1f}s …")
                await asyncio.sleep(backoff)
                backoff = min(backoff * _BACKOFF_FACTOR, _MAX_BACKOFF_S)


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
