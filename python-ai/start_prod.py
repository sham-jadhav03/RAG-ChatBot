#!/usr/bin/env python3
"""
Production startup script for Python AI Service.
Runs uvicorn without reload, with multiple workers.
"""
import sys
import logging
from pathlib import Path

project_dir = Path(__file__).parent
sys.path.insert(0, str(project_dir))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

def main():
    """Start the FastAPI application in production mode"""
    try:
        logger.info("Starting Python AI service (production)...")

        from app.config import config
        import uvicorn

        logger.info("Configuration loaded")

        uvicorn.run(
            "app.main:app",
            host=config.FASTAPI_HOST,
            port=config.FASTAPI_PORT,
            reload=False,
            workers=1,
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