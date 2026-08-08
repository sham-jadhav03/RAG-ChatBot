import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    #Server Settings
    PORT: int = 8000
    ENV: str = "development"

    #Redis Config
    REDIS_HOST: str ="localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""

    # Redis Channels (Matching Node.js Backend)
    REDIS_PDF_PROCESS_REQUEST_CHANNEL: str = "pdf_process_requests"
    REDIS_PDF_PROCESS_RESPONSE_CHANNEL: str = "pdf_process_responses"
    REDIS_CHAT_REQUEST_CHANNEL: str = "chat_requests"
    REDIS_CHAT_RESPONSE_CHANNEL: str = "chat_responses"

    # Database & AI Keys
    MONGO_URI: str = "mongodb://localhost:27017/rag_database"
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # Storage Directories
    CHROMA_DB_DIR: str = "./chroma_data"
    TEMP_UPLOAD_DIR: str = "./uploads"

    # Pydantic v2 Config
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


# Export singleton settings instance
settings = Settings()