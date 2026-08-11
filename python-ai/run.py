import sys
import logging
from pathlib import Path

# Add project root to Python path
project_dir = Path(__file__).parent
sys.path.insert(0, str(project_dir))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

def main():
    """Start the FastAPI application"""
    try:
        logger.info("Starting Python AI service...")

        from app.config import config
        import uvicorn

        logger.info("Configuration: REDIS_URL configured")

        uvicorn.run(
            "app.main:app",
            host=config.FASTAPI_HOST,
            port=config.FASTAPI_PORT,
            reload=config.FASTAPI_RELOAD,
            log_level=config.LOG_LEVEL.lower(),
        )

    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        sys.exit(0)

    except Exception as e:
        logger.error(f"Failed to start service: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
    