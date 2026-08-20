from pydantic import AnyHttpUrl, Field, RedisDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    telegram_bot_token: SecretStr
    pilot_api_base_url: AnyHttpUrl
    pilot_bot_service_token: SecretStr
    redis_url: RedisDsn
    pilot_staff_chat_id: int
    request_timeout_seconds: float = Field(default=8.0, ge=1.0, le=30.0)
