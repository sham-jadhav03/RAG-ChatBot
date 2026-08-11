import asyncio
import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.config import config

logger = logging.getLogger(__name__)

# Global reference to redis worker task
redis_worker_task = None

async def start_redis_worker():
    """Start the Redis listener in the background"""
    try:
        logger.info("Starting redis worker")

        from app.redis.redis_worker import listen_to_redis

        await listen_to_redis()

    except Exception as e:
        logger.error(f"Redis worker crashed: {e}", exc_info=True)
        raise

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""

    global redis_worker_task
    redis_worker_task = asyncio.create_task(start_redis_worker())
    
    logger.info("Application started, Redis Worker is running")
    try:
        yield
    finally:
        if redis_worker_task:
            redis_worker_task.cancel()
            try:
                await redis_worker_task
            except asyncio.CancelledError:
                logger.info("Redis worker stopped")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="PDF RAG AI Service",
    description="Handles PDF processing and RAG-based chat",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health")
async def health_check(): 
   """
    Health check endpoint for monitoring
    
    Returns:
        dict: Status indicator
    """
   return {
       "status": "ok",
        "service": "python-ai",
        "version": "1.0.0"
   }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "PDF RAG AI Service",
        "docs": "/docs",
        "health": "/health"
    }
 
 
if __name__ == "__main__":
    import uvicorn
 
    logger.info(f"Starting server on {config.FASTAPI_HOST}:{config.FASTAPI_PORT}")
    
    uvicorn.run(
        "app.main:app",
        host=config.FASTAPI_HOST,
        port=config.FASTAPI_PORT,
        reload=config.FASTAPI_RELOAD,
        log_level=config.LOG_LEVEL.lower()
    )