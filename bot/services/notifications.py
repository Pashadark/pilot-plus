import asyncio
from html import escape
from bot.keyboards.client import client_main_menu


def notification_target(job: dict) -> int:
    identity = job.get('identity') or {}
    chat = str(job.get('chatId') or '')
    if job.get('template') in {'RENTAL_RETURN_CLIENT', 'CLIENT_RENTAL_LIFECYCLE'}:
        target = str(identity.get('telegramUserId') or '')
        if (not chat and identity.get('isActive') is True and identity.get('kind') == 'CLIENT'
                and identity.get('clientId') and identity.get('companyId') == job.get('companyId')
                and target.isdigit() and int(target) > 0):
            return int(target)
    elif not identity and chat.startswith('-') and chat[1:].isdigit() and int(chat) < 0:
        return int(chat)
    raise ValueError('NOTIFICATION_RECIPIENT_DENIED')


def notification_content(job: dict) -> tuple[str, str | None]:
    payload = job.get("payload") or {}
    if job.get("template") == "BOT_RENTAL_REQUEST_CREATED":
        return f"Новая заявка на аренду · ID {escape(str(payload.get('requestId', '')))}", None
    message = str(payload.get("message") or "Уведомление СУПА ПРО")
    if job.get("template") == "DAILY_UNPAID_FINES" and len(message.encode("utf-16-le")) // 2 > 3900:
        # Report paragraphs are complete HTML blocks: never cut inside tags/entities.
        suffix = '\n\nПоказана часть сводки. Полный список: https://supapro.ru/fines'
        blocks = []
        for block in message.split('\n\n'):
            candidate = '\n\n'.join([*blocks, block]) + suffix
            if len(candidate.encode('utf-16-le')) // 2 > 3900:
                break
            blocks.append(block)
        message = '\n\n'.join(blocks) + suffix
    if payload.get("parseMode") == "HTML":
        return message, "HTML"
    return escape(message), None


async def send_notification(bot, target, job: dict) -> None:
    text, parse_mode = notification_content(job)
    if (job.get("payload") or {}).get("clientMenu") is True:
        await bot.send_message(target, text, parse_mode=parse_mode, reply_markup=client_main_menu())
        return
    if parse_mode:
        await bot.send_message(target, text, parse_mode=parse_mode)
    else:
        await bot.send_message(target, text)


async def notification_worker(bot, api, stop_event: asyncio.Event, staff_chat_id: int, worker_id: str = "pilot-bot") -> None:
    while not stop_event.is_set():
        try:
            jobs = (await api.claim_notifications(worker_id)).get("items", [])
            for job in jobs:
                try:
                    target = notification_target(job)
                    await send_notification(bot, target, job)
                except Exception as exc:
                    migrated_chat_id = getattr(exc, "migrate_to_chat_id", None)
                    if migrated_chat_id is not None:
                        print(f"notification_group_migrated={migrated_chat_id}", flush=True)
                        await send_notification(bot, migrated_chat_id, job)
                        await api.ack_notification(job["id"], job["claimToken"], True)
                    else:
                        print(f"notification_send_failed={type(exc).__name__}", flush=True)
                        await api.ack_notification(job["id"], job["claimToken"], False, "TELEGRAM_SEND_FAILED")
                else:
                    await api.ack_notification(job["id"], job["claimToken"], True)
        except Exception as exc:
            code = getattr(exc, "code", type(exc).__name__)
            print(f"notification_worker_failed={type(exc).__name__}:{code}", flush=True)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=5)
        except TimeoutError:
            continue
