from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(
        f"Python AI Service started "
        f"in '{settings.ENV}' mode on port {settings.PORT}"
    )

    yield
    print("Shutting down Python AI Service...")
app = FastAPI(
    title="Python AI Microservice",
    description="RAG & Document Processing Service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "python-ai",
        "environment": settings.ENV,
    }
