from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    cors_origins: str = "http://localhost:5173"

    # v0 auth: require a shared API key for mutations (UI will send it)
    mission_control_api_key: str | None = None

    openclaw_gateway_url: str | None = None
    openclaw_gateway_token: str | None = None

    telegram_chat_id: str | None = None
    telegram_topic_id: str | None = None

    # War room behavior
    apply_war_room_moves: bool = False

    # Secrets
    # Used to encrypt gateway tokens at rest (Fernet key).
    # Generate with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
    gateway_token_key: str | None = None

    # alias for env var APPLY_WAR_ROOM_MOVES
    # (pydantic-settings maps automatically from APPLY_WAR_ROOM_MOVES -> apply_war_room_moves)


settings = Settings()
