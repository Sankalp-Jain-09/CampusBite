from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables (and `.env` if present)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "CampusBite API"
    API_V1_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: str = "http://localhost:5173"
    SEED_DEMO_DATA: bool = False

    # Database
    DATABASE_URL: str

    # Auth
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    BCRYPT_ROUNDS: int = 12  # cost factor; tests lower it for speed

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    AI_RATE_LIMIT_PER_MINUTE: int = 10

    # Reminders
    REMINDER_THRESHOLD_MINUTES: int = 15
    REMINDER_CHECK_INTERVAL_SECONDS: int = 60
    REMINDER_WORKER_ENABLED: bool = True  # periodic scan in the app lifespan (tests turn it off)

    # Orders
    CANCEL_GRACE_SECONDS: int = 60
    DELIVERY_FEE: float = 30.0

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
