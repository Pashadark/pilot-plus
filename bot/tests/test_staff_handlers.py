from types import SimpleNamespace

import pytest

from bot.handlers.staff import (
    bind_work_group,
    legacy_staff_requests,
    staff_menu_action,
    staff_unknown_message,
)
from bot.keyboards.staff import STAFF_MENU_LABELS, STAFF_RENTALS_TEXT, STAFF_REQUESTS_TEXT
from bot.services.errors import PilotApiError


class FakeApi:
    def __init__(self, profile=None, error: Exception | None = None):
        self._profile = profile
        self._error = error
        self.profile_calls = []
        self.bind_calls = []
        self.operations_calls = []
        self.staff_rental_calls = []

    async def profile(self, telegram_user_id: str):
        self.profile_calls.append(telegram_user_id)
        if self._error:
            raise self._error
        return self._profile

    async def bind_work_group(self, telegram_user_id: str, telegram_chat_id: str, chat_type: str, title: str | None):
        self.bind_calls.append((telegram_user_id, telegram_chat_id, chat_type, title))
        return {"companyId": "company-1"}

    async def daily_operations(self, telegram_user_id: str):
        self.operations_calls.append(telegram_user_id)
        return {"date": "2026-08-20", "requests": [], "freeVehicles": [], "unavailableVehicles": []}

    async def staff_rentals(self, telegram_user_id: str):
        self.staff_rental_calls.append(telegram_user_id)
        return getattr(self, "staff_rentals_result", {"items": []})


class FakeMessage:
    def __init__(self, text: str, telegram_id: int):
        self.text = text
        self.from_user = SimpleNamespace(id=telegram_id)
        self.answers = []
        self.chat = SimpleNamespace(id=telegram_id, type="private", title=None)

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


@pytest.mark.asyncio
async def test_staff_admin_can_bind_current_work_group():
    api = FakeApi({"kind": "STAFF", "displayName": "Павел Седов"})
    message = FakeMessage("/pilot_setup", 185185047)
    message.chat = SimpleNamespace(id=-100777, type="supergroup", title="Pilot+ работа")

    await bind_work_group(message, api)

    assert api.bind_calls == [("185185047", "-100777", "supergroup", "Pilot+ работа")]
    assert message.answers[0][0] == "Группа Pilot+ привязана. Сюда будут приходить ежедневные сводки."


@pytest.mark.asyncio
async def test_bot_ignores_ordinary_group_messages():
    api = FakeApi({"kind": "STAFF", "displayName": "Павел Седов"})
    message = FakeMessage("20.08 Офис -2000 рублей", 185185047)
    message.chat = SimpleNamespace(id=-5147178959, type="group", title="TG Car / Офис Москва")

    await staff_unknown_message(message, api)

    assert message.answers == []
    assert api.profile_calls == []

    menu_message = FakeMessage(STAFF_REQUESTS_TEXT, 185185047)
    menu_message.chat = message.chat
    await staff_menu_action(menu_message, api)
    assert menu_message.answers == []
    assert api.profile_calls == []


@pytest.mark.asyncio
async def test_staff_rentals_are_sent_as_readable_individual_cards():
    api = FakeApi({"kind": "STAFF", "displayName": "Павел Седов"})
    api.staff_rentals_result = {"items": [{
        "id": "r1",
        "contractNumber": "ME-2026-0003-BK",
        "status": "ACTIVE",
        "startsAt": "2026-08-13T12:00:00Z",
        "endsAt": "2026-08-23T12:00:00Z",
        "clientName": "Горбунов Глеб Геннадьевич",
        "vehicle": {"make": "Volkswagen", "model": "Polo", "registrationNumber": "А156АХ997"},
        "action": "RETURN",
    }]}
    message = FakeMessage(STAFF_RENTALS_TEXT, 185185047)

    await staff_menu_action(message, api)

    assert len(message.answers) == 2
    assert message.answers[0][0] == "Текущие аренды: 1"
    card, markup = message.answers[1]
    assert "Горбунов Глеб Геннадьевич" in card
    assert "Volkswagen Polo · <b>А156АХ997</b>" in card
    assert "ME-2026-0003-BK" in card
    assert [row[0].text for row in markup.inline_keyboard] == ["Принять автомобиль", "Продлить аренду"]
