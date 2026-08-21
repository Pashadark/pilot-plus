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


@pytest.mark.asyncio
async def test_group_binding_sends_exact_group_context():
    captured = None

    def handler(request: httpx.Request):
        nonlocal captured
        captured = request
        return httpx.Response(200, json={"companyId": "company-1"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = PilotApiClient("https://pilot.example.com", "service-secret", http=http)
        await client.bind_work_group("185185047", "-100777", "supergroup", "Pilot+ работа")

    assert captured.url.path == "/api/bot/v1/group-bindings"
    assert captured.headers["X-Telegram-User-Id"] == "185185047"
    assert captured.read().decode() == '{"telegramChatId":"-100777","chatType":"supergroup","title":"Pilot+ работа"}'


@pytest.mark.asyncio
async def test_successful_notification_ack_omits_null_error_code():
    captured = None

    def handler(request: httpx.Request):
        nonlocal captured
        captured = request
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = PilotApiClient("https://pilot.example.com", "service-secret", http=http)
        await client.ack_notification("job-1", "claim-token-123456", True)

    assert captured.read().decode() == '{"claimToken":"claim-token-123456","success":true}'
