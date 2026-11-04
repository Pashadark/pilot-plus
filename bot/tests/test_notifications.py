from unittest.mock import AsyncMock

import pytest
import bot.services.notifications as notifications

from bot.services.notifications import notification_worker
from bot.services.notifications import notification_content
from bot.services.notifications import send_notification
from bot.services.notifications import cached_digest_part, remember_digest


def test_client_gps_event_is_delivered_only_to_the_linked_client_identity():
    job = {
        "companyId": "company-1",
        "template": "CLIENT_GPS_EVENT",
        "chatId": None,
        "identity": {
            "telegramUserId": "5370970341",
            "companyId": "company-1",
            "clientId": "client-1",
            "kind": "CLIENT",
            "isActive": True,
        },
    }

    assert notifications.notification_target(job) == 5370970341


def test_notification_polling_stays_fast_after_work_and_backs_off_when_idle():
    assert notifications.notification_poll_seconds(had_jobs=True) == 2
    assert notifications.notification_poll_seconds(had_jobs=False) == 15


@pytest.mark.asyncio
async def test_client_reminder_has_working_rental_and_extension_buttons():
    bot = AsyncMock()
    await send_notification(bot, "123", {"template": "RENTAL_RETURN_CLIENT", "payload": {"message": "Возврат", "clientMenu": True}})
    markup = bot.send_message.call_args.kwargs["reply_markup"]
    callbacks = [button.callback_data for row in markup.inline_keyboard for button in row]
    assert "client:rentals" in callbacks
    assert "client:extend" in callbacks


def test_daily_fines_report_fits_telegram_limit_without_cutting_html():
    message = '<b>Штрафы</b>\n\nВсего: <b>50</b>\n\n' + '\n\n'.join(
        '<b>Клиент</b>\nНарушение: ' + 'x' * 300 for _ in range(50)
    )
    text, mode = notification_content({'template': 'DAILY_UNPAID_FINES', 'payload': {'message': message, 'parseMode': 'HTML'}})
    assert len(text.encode('utf-16-le')) // 2 <= 4096
    assert 'https://supapro.ru/fines' in text
    assert text.count('<b>') == text.count('</b>')
    assert mode == 'HTML'


def test_digest_cache_keeps_navigation_parts_by_chat_and_date():
    remember_digest(-100777, {
        "digestDate": "2026-10-23",
        "digestParts": {
            "critical": {"message": "Критичное", "actions": []},
            "trackers": {"message": "Трекеры", "actions": []},
            "totals": {"message": "Итоги", "actions": []},
            "unsafe": "ignored",
        },
    })

    assert cached_digest_part(-100777, "2026-10-23", "trackers") == {
        "message": "Трекеры",
        "actions": [],
    }
    assert cached_digest_part(-100777, "2026-10-22", "trackers") is None


@pytest.mark.asyncio
async def test_worker_acks_only_after_send_succeeds():
    bot = AsyncMock()
    api = AsyncMock()
    api.claim_notifications.side_effect = [{"items": [{"id": "j1", "claimToken": "token", "companyId": "c", "template": "RENTAL_RETURN_CLIENT", "payload": {"message": "Возврат"}, "identity": {"telegramUserId": "123", "companyId": "c", "clientId": "cl", "kind": "CLIENT", "isActive": True}, "chatId": None}]}, {"items": []}]
    stop = __import__("asyncio").Event()
    async def ack(*args):
        stop.set()
    api.ack_notification.side_effect = ack
    await notification_worker(bot, api, stop, -1001)
    bot.send_message.assert_awaited_once_with(123, "Возврат")
    api.ack_notification.assert_awaited_once_with("j1", "token", True)


@pytest.mark.asyncio
async def test_worker_sends_group_job_with_null_identity():
    bot = AsyncMock()
    api = AsyncMock()
    api.claim_notifications.side_effect = [
        {
            "items": [
                {
                    "id": "daily-1",
                    "claimToken": "token",
                    "template": "DAILY_OPERATIONS_DIGEST",
                    "payload": {
                        "message": "<b>Сводка СУПА ПРО</b>",
                        "parseMode": "HTML",
                    },
                    "identity": None,
                    "chatId": "-100777",
                }
            ]
        },
        {"items": []},
    ]
    stop = __import__("asyncio").Event()

    async def ack(*args):
        stop.set()

    api.ack_notification.side_effect = ack
    await notification_worker(bot, api, stop, 0)

    bot.send_message.assert_awaited_once_with(
        -100777,
        "<b>Сводка СУПА ПРО</b>",
        parse_mode="HTML",
    )
    api.ack_notification.assert_awaited_once_with("daily-1", "token", True)


@pytest.mark.asyncio
async def test_html_notification_delivers_allow_listed_actions_as_inline_keyboard():
    bot = AsyncMock()
    await send_notification(bot, -100777, {
        "template": "DAILY_OPERATIONS_DIGEST",
        "payload": {
            "message": "<b>Критическая сводка</b>",
            "parseMode": "HTML",
            "actions": [
                {"type": "summary_section", "label": "🟠 Трекеры и GPS", "section": "trackers", "date": "2026-10-23"},
                {"type": "unknown", "label": "Опасная кнопка", "url": "javascript:alert(1)"},
            ],
        },
    })

    kwargs = bot.send_message.await_args.kwargs
    assert kwargs["parse_mode"] == "HTML"
    buttons = kwargs["reply_markup"].inline_keyboard
    assert [[button.callback_data for button in row] for row in buttons] == [
        ["notify:section:trackers:2026-10-23"],
    ]


@pytest.mark.asyncio
async def test_worker_retries_a_group_that_telegram_migrated_to_a_supergroup():
    class MigratedGroupError(Exception):
        migrate_to_chat_id = -1009876543210

    bot = AsyncMock()
    bot.send_message.side_effect = [MigratedGroupError(), None]
    api = AsyncMock()
    api.claim_notifications.return_value = {
        "items": [
            {
                "id": "daily-2",
                "claimToken": "token-2",
                "template": "DAILY_OPERATIONS_DIGEST",
                "payload": {"message": "Сводка"},
                "identity": None,
                "chatId": "-5147178959",
            }
        ]
    }
    stop = __import__("asyncio").Event()

    async def ack(*args):
        stop.set()

    api.ack_notification.side_effect = ack
    await notification_worker(bot, api, stop, 0)

    assert bot.send_message.await_args_list[1].args == (-1009876543210, "Сводка")
    api.ack_notification.assert_awaited_once_with("daily-2", "token-2", True)

def test_rental_request_uses_the_shared_supapro_block_layout():
    text, mode = notification_content({
        "template": "BOT_RENTAL_REQUEST_CREATED",
        "payload": {"requestId": "request-123"},
    })

    assert "📥 <b>Новая заявка на аренду</b>" in text
    assert "📄 <b>Заявка</b>\n└ ID <code>request-123</code>" in text
    assert "⚡ <b>Действие</b>" in text
    assert mode == "HTML"


def test_hydrated_rental_request_keeps_server_message_and_actions():
    text, mode = notification_content({
        "template": "BOT_RENTAL_REQUEST_CREATED",
        "payload": {
            "message": "📥 <b>Новая заявка</b>\n\n👤 <b>Клиент</b>\n└ Иванов Иван",
            "parseMode": "HTML",
        },
    })

    assert "Иванов Иван" in text
    assert "ID" not in text
    assert mode == "HTML"
