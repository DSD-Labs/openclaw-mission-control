from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    cors_origins: str = "http://localhost:5173"

    openclaw_gateway_url: str | None = None
    openclaw_gateway_token: str | None = None

    telegram_chat_id: str | None = None
    telegram_topic_id: str | None = None


settings = Settings()
