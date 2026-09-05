import asyncio
import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.config import config

logger = logging.getLogger(__name__)

# Global reference to redis worker task and worker instance
redis_worker_task = None
redis_worker_instance = None

async def start_redis_worker():
    """Start the Redis listener in the background"""
    try:
        logger.info("Starting redis worker")

        from app.redis.redis_worker import listen_to_redis, get_worker_instance

        await listen_to_redis()

    except Exception as e:
        logger.error(f"Redis worker crashed: {e}", exc_info=True)
        raise

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""

    global redis_worker_task, redis_worker_instance
    redis_worker_task = asyncio.create_task(start_redis_worker())
    
    # Give worker time to start and get instance reference
    await asyncio.sleep(0.1)
    from app.redis.redis_worker import get_worker_instance
    redis_worker_instance = get_worker_instance()
    
    logger.info("Application started, Redis Worker is running")
    try:
        yield
    finally:
        logger.info("Shutting down application...")
        
        # Graceful shutdown: wait for active tasks with bounded timeout
        if redis_worker_instance:
            try:
                logger.info("Initiating Redis worker graceful shutdown...")
                await asyncio.wait_for(redis_worker_instance.cleanup(), timeout=30.0)
                logger.info("Redis worker cleanup completed")
            except asyncio.TimeoutError:
                logger.warning("Redis worker cleanup timed out after 30s, forcing exit")
            except Exception as e:
                logger.error(f"Error during Redis worker cleanup: {e}", exc_info=True)
        
        # Close MongoDB connection
        try:
            from app.db.mongo_client import close_mongo_client
            await close_mongo_client()
            logger.info("MongoDB connection closed")
        except Exception as e:
            logger.error(f"Error closing MongoDB: {e}", exc_info=True)
        
        # Cancel the worker task if still running
        if redis_worker_task and not redis_worker_task.done():
            redis_worker_task.cancel()
            try:
                await redis_worker_task
            except asyncio.CancelledError:
                logger.info("Redis worker task cancelled")
            except Exception as e:
                logger.error(f"Error waiting for worker task: {e}")
        
        logger.info("Application shutdown complete")

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