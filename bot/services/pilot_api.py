from collections.abc import Mapping
from typing import Any

import httpx

from .errors import PilotApiError

MAX_RESPONSE_BYTES = 1_048_576


class PilotApiClient:
    def __init__(self, base_url: str, service_token: str, *, timeout: float = 8.0, http: httpx.AsyncClient | None = None):
        self._base_url = base_url.rstrip("/")
        self._service_token = service_token
        self._owned_http = http is None
        self._http = http or httpx.AsyncClient(timeout=httpx.Timeout(timeout), follow_redirects=False)

    def _headers(self, telegram_user_id: str, idempotency_key: str | None = None) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self._service_token}", "X-Telegram-User-Id": telegram_user_id, "Accept": "application/json"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return headers

    async def _json(self, method: str, path: str, *, telegram_user_id: str, json: Mapping[str, Any] | None = None, idempotency_key: str | None = None) -> dict[str, Any]:
        try:
            response = await self._http.request(method, f"{self._base_url}{path}", headers=self._headers(telegram_user_id, idempotency_key), json=json)
        except httpx.HTTPError as exc:
            raise PilotApiError("PILOT_UNAVAILABLE", 503) from exc
        if len(response.content) > MAX_RESPONSE_BYTES:
            raise PilotApiError("RESPONSE_TOO_LARGE", 502)
        if response.is_error:
            try:
                code = response.json().get("error", {}).get("code", "PILOT_ERROR")
            except (ValueError, AttributeError):
                code = "PILOT_ERROR"
            raise PilotApiError(str(code), response.status_code)
        try:
            payload = response.json()
        except ValueError as exc:
            raise PilotApiError("INVALID_RESPONSE", 502) from exc
        if not isinstance(payload, dict):
            raise PilotApiError("INVALID_RESPONSE", 502)
        return payload

    async def profile(self, telegram_user_id: str) -> dict[str, Any]:
        return await self._json("GET", "/api/bot/v1/me", telegram_user_id=telegram_user_id)

    async def link_identity(self, invite_token: str, telegram_user_id: str) -> dict[str, Any]:
        return await self._json("POST", "/api/bot/v1/link", telegram_user_id=telegram_user_id, json={"inviteToken": invite_token, "telegramUserId": telegram_user_id})

    async def rentals(self, telegram_user_id: str) -> dict[str, Any]:
        return await self._json("GET", "/api/bot/v1/rentals", telegram_user_id=telegram_user_id)

    async def availability(self, telegram_user_id: str, starts_at: str, ends_at: str) -> dict[str, Any]:
        params = httpx.QueryParams({"startsAt": starts_at, "endsAt": ends_at})
        return await self._json("GET", f"/api/bot/v1/availability?{params}", telegram_user_id=telegram_user_id)

    async def rental_documents(self, telegram_user_id: str, rental_id: str) -> dict[str, Any]:
        return await self._json("POST", f"/api/bot/v1/rentals/{rental_id}/documents", telegram_user_id=telegram_user_id)

    async def create_rental_request(self, telegram_user_id: str, payload: Mapping[str, Any], idempotency_key: str) -> dict[str, Any]:
        return await self._json("POST", "/api/bot/v1/rental-requests", telegram_user_id=telegram_user_id, json=payload, idempotency_key=idempotency_key)

    async def bind_work_group(self, telegram_user_id: str, telegram_chat_id: str, chat_type: str, title: str | None) -> dict[str, Any]:
        payload: dict[str, Any] = {"telegramChatId": telegram_chat_id, "chatType": chat_type}
        if title:
            payload["title"] = title
        return await self._json("POST", "/api/bot/v1/group-bindings", telegram_user_id=telegram_user_id, json=payload)

    async def daily_operations(self, telegram_user_id: str, date: str | None = None) -> dict[str, Any]:
        path = "/api/bot/v1/daily-operations"
        if date:
            path = f"{path}?{httpx.QueryParams({'date': date})}"
        return await self._json("GET", path, telegram_user_id=telegram_user_id)

    async def claim_notifications(self, worker_id: str) -> dict[str, Any]:
        return await self._json("POST", "/api/bot/v1/notifications/claim", telegram_user_id="", json={"workerId": worker_id})

    async def ack_notification(self, job_id: str, claim_token: str, success: bool, error_code: str | None = None) -> dict[str, Any]:
        return await self._json("POST", f"/api/bot/v1/notifications/{job_id}/ack", telegram_user_id="", json={"claimToken": claim_token, "success": success, "errorCode": error_code})

    async def close(self) -> None:
        if self._owned_http:
            await self._http.aclose()
