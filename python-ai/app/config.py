import os
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv()


class Config:
    """Application configuration from environment variables"""

    # Redis configuration
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

    # MONGO_URI configuration
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/rag_database")

    # CHROMA configuration
    CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_data")

    # PDF Processing Configuration
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
    CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))

    # chat configuration
    TOP_K_RETRIEVAL = int(os.getenv("TOP_K_RETRIEVAL", "5"))

    # FastAPI Configuration
    FASTAPI_HOST = os.getenv("FASTAPI_HOST", "0.0.0.0")
    FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", "8000"))
    FASTAPI_RELOAD = os.getenv("FASTAPI_RELOAD", "True").lower() == "true"

    # Logger configuration
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    @classmethod
    def validate(cls):
        """Validate critical configuration"""
        if not cls.REDIS_URL:
            raise ValueError("Missing REDIS_URL in .env")

        if not cls.MONGO_URI:
            raise ValueError("Missing MONGO_URI in .env")

        if cls.CHUNK_SIZE <= 0:
            raise ValueError("CHUNK_SIZE must be greater than 0")

        if cls.CHUNK_OVERLAP < 0:
            raise ValueError("CHUNK_OVERLAP cannot be negative")

        if cls.CHUNK_OVERLAP >= cls.CHUNK_SIZE:
            raise ValueError("CHUNK_OVERLAP must be smaller than CHUNK_SIZE")

        if cls.TOP_K_RETRIEVAL <= 0:
            raise ValueError("TOP_K_RETRIEVAL must be greater than 0")

        if not 1 <= cls.FASTAPI_PORT <= 65535:
            raise ValueError("FASTAPI_PORT must be between 1 and 65535")


# Validate on import
Config.validate()

# Export instance for use in other modules
config = Config()

__all__ = ["Config", "config"]