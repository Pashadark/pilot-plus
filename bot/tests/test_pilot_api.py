import httpx
import pytest

from bot.services.pilot_api import PilotApiClient


@pytest.mark.asyncio
async def test_client_sends_only_service_identity_and_idempotency_headers():
    captured = None

    def handler(request: httpx.Request):
        nonlocal captured
        captured = request
        return httpx.Response(201, json={"id": "request-1"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as http:
        client = PilotApiClient("https://pilot.example.com", "service-secret", http=http)
        result = await client.create_rental_request("123", {"startsAt": "x"}, "tg-update-77")

    assert result == {"id": "request-1"}
    assert captured.headers["Authorization"] == "Bearer service-secret"
    assert captured.headers["X-Telegram-User-Id"] == "123"
    assert captured.headers["Idempotency-Key"] == "tg-update-77"
