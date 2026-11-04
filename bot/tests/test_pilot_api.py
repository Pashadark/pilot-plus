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
        await client.bind_work_group("185185047", "-100777", "supergroup", "СУПА ПРО работа")

    assert captured.url.path == "/api/bot/v1/group-bindings"
    assert captured.headers["X-Telegram-User-Id"] == "185185047"
    assert captured.read().decode() == '{"telegramChatId":"-100777","chatType":"supergroup","title":"СУПА ПРО работа"}'


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


@pytest.mark.asyncio
async def test_staff_operation_uses_bounded_multipart_with_exact_rental_path():
    captured = None

    def handler(request: httpx.Request):
        nonlocal captured
        captured = request
        return httpx.Response(200, json={"rentalId": "rental-1", "operationId": "operation-1"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = PilotApiClient("https://pilot.example.com", "service-secret", http=http)
        result = await client.complete_rental_operation(
            "185185047",
            "rental-1",
            "HANDOVER",
            {"mileageKm": "10000", "fuelLevelPercent": "80"},
            video=("inspection.mp4", b"video", "video/mp4"),
            dashboard_photo=("dashboard.jpg", b"photo", "image/jpeg"),
        )

    assert result["operationId"] == "operation-1"
    assert captured.url.path == "/api/bot/v1/rentals/rental-1/handover"
    assert captured.headers["X-Telegram-User-Id"] == "185185047"
    assert "multipart/form-data" in captured.headers["Content-Type"]
    body = captured.read()
    assert b'inspectionVideo' in body
    assert b'dashboardPhoto' in body


@pytest.mark.asyncio
async def test_client_deposits_use_the_scoped_bot_endpoint():
    captured = None

    def handler(request: httpx.Request):
        nonlocal captured
        captured = request
        return httpx.Response(200, json={"items": []})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = PilotApiClient("https://supapro.example.com", "service-secret", http=http)
        await client.deposits("123")

    assert captured.url.path == "/api/bot/v1/deposits"
    assert captured.headers["X-Telegram-User-Id"] == "123"


@pytest.mark.asyncio
async def test_client_notification_worker_declares_its_audience():
    captured = None

    def handler(request: httpx.Request):
        nonlocal captured
        captured = request
        return httpx.Response(200, json={"items": []})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = PilotApiClient("https://supapro.example.com", "service-secret", http=http)
        await client.claim_notifications("supa-client-bot", "CLIENT")

    assert captured.read().decode() == '{"workerId":"supa-client-bot","audience":"CLIENT"}'


@pytest.mark.asyncio
async def test_staff_return_reminder_uses_the_scoped_notification_endpoint():
    captured = None

    def handler(request: httpx.Request):
        nonlocal captured
        captured = request
        return httpx.Response(202, json={"ok": True, "queued": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = PilotApiClient("https://supapro.example.com", "service-secret", http=http)
        await client.remind_return("185185047", "rental-1")

    assert captured.url.path == "/api/bot/v1/notifications/remind"
    assert captured.headers["X-Telegram-User-Id"] == "185185047"
    assert captured.read().decode() == '{"rentalId":"rental-1"}'


@pytest.mark.asyncio
async def test_staff_impound_warning_uses_the_scoped_notification_endpoint():
    captured = None

    def handler(request: httpx.Request):
        nonlocal captured
        captured = request
        return httpx.Response(202, json={"ok": True, "queued": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = PilotApiClient("https://supapro.example.com", "service-secret", http=http)
        await client.notify_client_impound("185185047", "rental-1")

    assert captured.url.path == "/api/bot/v1/notifications/notify-client"
    assert captured.headers["X-Telegram-User-Id"] == "185185047"
    assert captured.read().decode() == '{"rentalId":"rental-1","reason":"IMPOUND_LOT"}'
