import asyncio
from html import escape


def notification_text(job: dict) -> str:
    payload = job.get("payload") or {}
    if job.get("template") == "BOT_RENTAL_REQUEST_CREATED":
        return f"Новая заявка на аренду · ID {escape(str(payload.get('requestId', '')))}"
    return escape(str(payload.get("message") or "Уведомление Pilot+"))


async def notification_worker(bot, api, stop_event: asyncio.Event, staff_chat_id: int, worker_id: str = "pilot-bot") -> None:
    while not stop_event.is_set():
        try:
            jobs = (await api.claim_notifications(worker_id)).get("items", [])
            for job in jobs:
                target = job.get("identity", {}).get("telegramUserId")
                chat_id = str(job.get("chatId") or "")
                if not target and chat_id.startswith("staff:"):
                    target = staff_chat_id
                elif not target and chat_id.lstrip("-").isdigit():
                    target = int(chat_id)
                try:
                    await bot.send_message(target, notification_text(job))
                except Exception:
                    await api.ack_notification(job["id"], job["claimToken"], False, "TELEGRAM_SEND_FAILED")
                else:
                    await api.ack_notification(job["id"], job["claimToken"], True)
        except Exception:
            pass
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=5)
        except TimeoutError:
            continue
