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
