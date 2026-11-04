from pydantic import AnyHttpUrl, Field, RedisDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class ClientSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    client_telegram_bot_token: SecretStr
    supa_pro_api_base_url: AnyHttpUrl
    supa_pro_bot_service_token: SecretStr
    redis_url: RedisDsn
    request_timeout_seconds: float = Field(default=8.0, ge=1.0, le=30.0)
