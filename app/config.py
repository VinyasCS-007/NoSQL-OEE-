from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017"
    db_name: str = "oee_chat"
    jwt_secret: str = "change-me"
    guest_message_ttl_hours: int = 24
    # Vite dev server (npm run dev) and production preview (npm run preview)
    cors_origins: str = "http://localhost:5173,http://localhost:4173"
    # "production" on the public server: refuses to start with the default JWT secret
    environment: str = "development"
    # create the default public rooms on startup when the rooms collection is empty
    seed_default_rooms: bool = False


settings = Settings()
