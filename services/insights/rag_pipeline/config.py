"""Environment configuration with Pydantic Settings validation."""

from pathlib import Path

from pydantic_settings import BaseSettings
from pydantic import Field

# Resolve .env relative to this file: rag_pipeline/ -> insights/ -> services/ -> repo root
_ENV_FILE = Path(__file__).resolve().parent.parent.parent.parent / ".env"


class Settings(BaseSettings):
    # Server
    RAG_PORT: int = Field(default=4004, description="Port for the RAG pipeline service")

    # MySQL
    MYSQL_HOST: str = Field(default="127.0.0.1")
    MYSQL_PORT: int = Field(default=3306)
    MYSQL_USER: str = Field(default="root")
    MYSQL_PASSWORD: str = Field(default="")
    INSIGHTS_DATABASE: str = Field(default="insights")
    DB_POOL_SIZE: int = Field(default=10)

    # Auth
    JWT_SECRET: str = Field(min_length=24, description="Shared JWT secret (must match auth/finance services)")

    # External services
    FINANCE_API_URL: str = Field(default="http://localhost:4001")
    FRONTEND_ORIGIN: str = Field(default="http://localhost:5173")

    # AI Model
    GEMINI_API_KEY: str = Field(min_length=10, description="Google Gemini API key")
    MODEL_NAME: str = Field(default="gemini-2.5-flash-lite")

    # Tuning
    CONTEXT_CACHE_TTL: int = Field(default=30, description="Seconds to cache finance context per account")
    MAX_TRANSACTIONS: int = Field(default=20, description="Max recent transactions in context")
    MAX_CATEGORIES: int = Field(default=5, description="Max top categories in analytics")
    MAX_BUDGETS: int = Field(default=3, description="Max budgets in context")
    MAX_HISTORY: int = Field(default=10, description="Max chat history messages for conversation")

    model_config = {"env_file": str(_ENV_FILE), "extra": "ignore"}


settings = Settings()
