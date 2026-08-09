import sys 
import logging
from pathlib import Path

# Add app directory to python path
app_dir = Path(__file__).parent / "app"
sys.path.insert(0, str(app_dir))

# Configure logging before imports
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

def main():
    """Start the FastAPI application"""
    try:
        logger.info("Starting Python AI service...")

        # Import after path is set
        from app.main import app
        from app.config import config
        import uvicorn

        logger.info(f" Configuration: REDIS_URL={config.REDIS_URL}")
        # logger.info(f" OpenAI Model: {config.LLM_MODEL}")
        # logger.info(f" Embedding Model: {config.EMBEDDING_MODEL}")
        # logger.info(f"  Chroma Path: {config.CHROMA_PATH}")

        # Start Uvicorn server
        uvicorn.run(
            app,
            host=config.FASTAPI_HOST,
            port=config.FASTAPI_PORT,
            reload=config.FASTAPI_RELOAD,
            log_level=config.LOG_LEVEL.lower()
        )

    except KeyboardInterrupt:
        logger.info(" Server stopped by user")
        sys.exit(0)
        
    except Exception as e:
        logger.error(f" Failed to start service: {e}", exc_info=True)
        sys.exit(1)
 
 
if __name__ == "__main__":
    main()
    