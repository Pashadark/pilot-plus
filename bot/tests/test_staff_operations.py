from types import SimpleNamespace

import pytest

from bot.handlers.staff_operations import operation_start, positive_integer, rubles_to_minor
from bot.states.rental import StaffOperationForm


class FakeState:
    def __init__(self):
        self.data = {}
        self.state = None

    async def clear(self):
        self.data = {}

    async def update_data(self, **values):
        self.data.update(values)

    async def set_state(self, value):
        self.state = value


class FakeCallback:
    def __init__(self):
        self.data = "staffop:HANDOVER:rental-1"
        self.from_user = SimpleNamespace(id=185185047)
        self.message = SimpleNamespace(answer=self.answer_message)
        self.messages = []
        self.answered = False

    async def answer_message(self, text, **_kwargs):
        self.messages.append(text)

    async def answer(self, *_args, **_kwargs):
        self.answered = True


def test_operation_numeric_fields_are_strict_and_money_is_minor_units():
    assert positive_integer("125430", 9_999_999) == 125430
    assert positive_integer("101", 100) is None
    assert rubles_to_minor("15000,50") == 1_500_050
    assert rubles_to_minor("-1") is None


@pytest.mark.asyncio
async def test_private_staff_operation_starts_with_exact_rental_and_durable_key():
    callback = FakeCallback()
    state = FakeState()

    await operation_start(callback, state)

    assert state.data["operation"] == "HANDOVER"
    assert state.data["rentalId"] == "rental-1"
    assert state.data["idempotencyKey"].startswith("tg-operation-185185047-")
    assert state.state == StaffOperationForm.mileage
    assert callback.answered is True
