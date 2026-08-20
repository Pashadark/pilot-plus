import pytest
from pydantic import ValidationError

from bot.config import Settings


def test_settings_reject_missing_secrets(monkeypatch):
    for name in ("TELEGRAM_BOT_TOKEN", "PILOT_BOT_SERVICE_TOKEN", "PILOT_API_BASE_URL", "REDIS_URL"):
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_accept_valid_environment(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456:telegram-secret")
    monkeypatch.setenv("PILOT_BOT_SERVICE_TOKEN", "service-secret-with-enough-entropy")
    monkeypatch.setenv("PILOT_API_BASE_URL", "https://pilot.example.com")
    monkeypatch.setenv("REDIS_URL", "redis://redis:6379/1")
    monkeypatch.setenv("PILOT_STAFF_CHAT_ID", "-1001234567890")
    settings = Settings(_env_file=None)
    assert str(settings.pilot_api_base_url) == "https://pilot.example.com/"
