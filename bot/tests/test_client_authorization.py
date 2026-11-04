from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from bot.handlers.start import start, verify_contact
from bot.services.errors import PilotApiError


def message(chat_type="private"):
    return SimpleNamespace(from_user=SimpleNamespace(id=123), chat=SimpleNamespace(type=chat_type), answer=AsyncMock())


@pytest.mark.asyncio
async def test_start_in_group_never_links_or_discloses_profile():
    msg = message("supergroup")
    api = SimpleNamespace(link_identity=AsyncMock(), profile=AsyncMock())
    await start(msg, SimpleNamespace(args="personal-invite-token"), api, AsyncMock())
    api.link_identity.assert_not_called()
    api.profile.assert_not_called()


@pytest.mark.asyncio
async def test_first_visit_without_invite_requests_own_contact():
    msg = message()
    state = AsyncMock()
    api = SimpleNamespace(profile=AsyncMock(side_effect=PilotApiError("IDENTITY_REQUIRED", 401)))
    await start(msg, SimpleNamespace(args=None), api, state)
    assert msg.answer.call_args.kwargs["reply_markup"].keyboard[0][0].request_contact is True


@pytest.mark.asyncio
async def test_single_bot_shows_staff_menu_to_existing_staff_identity():
    msg = message()
    state = AsyncMock()
    api = SimpleNamespace(
        profile=AsyncMock(return_value={"kind": "STAFF", "displayName": "Павел Седов"})
    )

    await start(msg, SimpleNamespace(args=None), api, state)

    msg.answer.assert_awaited_once()
    assert "рабочий раздел" in msg.answer.call_args.args[0].lower()
    labels = [
        button.text
        for row in msg.answer.call_args.kwargs["reply_markup"].keyboard
        for button in row
    ]
    assert "Аренды" in labels
    assert "Штрафы" in labels


@pytest.mark.asyncio
async def test_rental_callbacks_do_not_disclose_data_in_group():
    from bot.handlers.rentals import my_rentals
    callback = SimpleNamespace(from_user=SimpleNamespace(id=123), message=message("supergroup"), answer=AsyncMock())
    api = SimpleNamespace(rentals=AsyncMock(return_value={"items": []}))
    await my_rentals(callback, api)
    api.rentals.assert_not_called()


@pytest.mark.asyncio
async def test_forwarded_contact_never_reaches_api():
    msg = message()
    msg.contact = SimpleNamespace(user_id=999, phone_number="79167176556")
    api = SimpleNamespace(link_identity=AsyncMock())
    await verify_contact(msg, AsyncMock(), api)
    api.link_identity.assert_not_called()


@pytest.mark.asyncio
async def test_matching_contact_passes_proof_and_clears_pending_invite():
    msg = message()
    msg.contact = SimpleNamespace(user_id=123, phone_number="79167176556")
    state = AsyncMock()
    state.get_data.return_value = {"invite_token": "personal-invite-token", "expires_at": 9999999999}
    api = SimpleNamespace(link_identity=AsyncMock(return_value={"kind": "CLIENT", "displayName": "Иван"}), rentals=AsyncMock(return_value={"items": []}))
    await verify_contact(msg, state, api)
    api.link_identity.assert_awaited_once_with("personal-invite-token", "123", phone_number="79167176556", contact_user_id="123")
    state.clear.assert_awaited_once()


@pytest.mark.asyncio
async def test_expired_contact_attempt_does_not_link():
    msg = message()
    msg.contact = SimpleNamespace(user_id=123, phone_number="79167176556")
    state = AsyncMock()
    state.get_data.return_value = {"invite_token": "personal-invite-token", "expires_at": 1}
    api = SimpleNamespace(link_identity=AsyncMock())
    await verify_contact(msg, state, api)
    api.link_identity.assert_not_called()
    state.clear.assert_awaited_once()


@pytest.mark.asyncio
async def test_client_invite_requests_native_contact_and_preserves_token():
    msg = message()
    state = AsyncMock()
    api = SimpleNamespace(link_identity=AsyncMock(side_effect=PilotApiError("CONTACT_REQUIRED", 400)), profile=AsyncMock())
    await start(msg, SimpleNamespace(args="personal-invite-token"), api, state)
    state.update_data.assert_called_once()
    data = state.update_data.call_args.kwargs
    assert data["invite_token"] == "personal-invite-token"
    keyboard = msg.answer.call_args.kwargs["reply_markup"]
    assert keyboard.keyboard[0][0].request_contact is True
    api.profile.assert_not_called()
