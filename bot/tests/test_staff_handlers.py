from types import SimpleNamespace

import pytest

from bot.handlers.staff import legacy_staff_requests, staff_menu_action
from bot.keyboards.staff import STAFF_MENU_LABELS, STAFF_REQUESTS_TEXT
from bot.services.errors import PilotApiError


class FakeApi:
    def __init__(self, profile=None, error: Exception | None = None):
        self._profile = profile
        self._error = error
        self.profile_calls = []

    async def profile(self, telegram_user_id: str):
        self.profile_calls.append(telegram_user_id)
        if self._error:
            raise self._error
        return self._profile


class FakeMessage:
    def __init__(self, text: str, telegram_id: int):
        self.text = text
        self.from_user = SimpleNamespace(id=telegram_id)
        self.answers = []

    async def answer(self, text: str, **kwargs):
        self.answers.append((text, kwargs.get("reply_markup")))


class FakeCallback:
    def __init__(self, telegram_id: int):
        self.from_user = SimpleNamespace(id=telegram_id)
        self.message = FakeMessage("", telegram_id)
        self.answers = []

    async def answer(self, text=None, **kwargs):
        self.answers.append((text, kwargs))


@pytest.mark.asyncio
async def test_each_staff_label_returns_a_message_for_staff():
    api = FakeApi({"kind": "STAFF", "displayName": "Павел Седов"})

    for label in STAFF_MENU_LABELS:
        message = FakeMessage(label, 185185047)
        await staff_menu_action(message, api)
        assert len(message.answers) == 1
        assert message.answers[0][1] is not None

    assert api.profile_calls == ["185185047"] * len(STAFF_MENU_LABELS)


@pytest.mark.asyncio
async def test_client_cannot_use_staff_menu():
    message = FakeMessage(STAFF_REQUESTS_TEXT, 42)

    await staff_menu_action(message, FakeApi({"kind": "CLIENT", "displayName": "Клиент"}))

    assert message.answers == [("Этот раздел доступен только сотрудникам Pilot+.", None)]


@pytest.mark.asyncio
async def test_staff_menu_reports_api_failure():
    message = FakeMessage(STAFF_REQUESTS_TEXT, 185185047)

    await staff_menu_action(message, FakeApi(error=PilotApiError("offline")))

    assert message.answers == [("Не удалось связаться с Pilot+. Попробуйте ещё раз.", None)]


@pytest.mark.asyncio
async def test_legacy_staff_callback_is_acknowledged():
    callback = FakeCallback(185185047)

    await legacy_staff_requests(callback, FakeApi({"kind": "STAFF", "displayName": "Павел Седов"}))

    assert callback.answers == [(None, {})]
    assert len(callback.message.answers) == 1
