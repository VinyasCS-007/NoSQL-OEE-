from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    db_name: str = "oee_chat"
    jwt_secret: str = "change-me"
    guest_message_ttl_hours: int = 24
    cors_origins: str = "http://localhost:5173"


settings = Settings()
