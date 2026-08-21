from unittest.mock import AsyncMock

import pytest

from bot.services.notifications import notification_worker


@pytest.mark.asyncio
async def test_worker_acks_only_after_send_succeeds():
    bot = AsyncMock()
    api = AsyncMock()
    api.claim_notifications.side_effect = [{"items": [{"id": "j1", "claimToken": "token", "template": "RETURN", "payload": {"message": "Возврат"}, "identity": {"telegramUserId": "123"}, "chatId": None}]}, {"items": []}]
    stop = __import__("asyncio").Event()
    async def ack(*args):
        stop.set()
    api.ack_notification.side_effect = ack
    await notification_worker(bot, api, stop, -1001)
    bot.send_message.assert_awaited_once_with("123", "Возврат")
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
                    "payload": {"message": "Свободные машины"},
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

    bot.send_message.assert_awaited_once_with(-100777, "Свободные машины")
    api.ack_notification.assert_awaited_once_with("daily-1", "token", True)


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
