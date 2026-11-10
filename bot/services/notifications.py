import asyncio
from html import escape
from aiogram.exceptions import TelegramBadRequest
from bot.keyboards.client import client_main_menu
from bot.keyboards.notifications import notification_actions


_SUMMARY_CACHE: dict[tuple[str, str], dict] = {}
_SUMMARY_CACHE_LIMIT = 64


def remember_digest(target: int | str, payload: dict) -> None:
    date = str(payload.get("digestDate") or "")
    parts = payload.get("digestParts")
    if not date or not isinstance(parts, dict):
        return
    safe_parts = {
        key: value
        for key, value in parts.items()
        if key in {"critical", "trackers", "totals"}
        and isinstance(value, dict)
        and isinstance(value.get("message"), str)
    }
    if not safe_parts:
        return
    key = (str(target), date)
    _SUMMARY_CACHE.pop(key, None)
    _SUMMARY_CACHE[key] = safe_parts
    while len(_SUMMARY_CACHE) > _SUMMARY_CACHE_LIMIT:
        _SUMMARY_CACHE.pop(next(iter(_SUMMARY_CACHE)))


def cached_digest_part(target: int | str, date: str, section: str) -> dict | None:
    return (_SUMMARY_CACHE.get((str(target), date)) or {}).get(section)


def notification_poll_seconds(had_jobs: bool) -> int:
    return 2 if had_jobs else 15


def notification_target(job: dict) -> int:
    identity = job.get('identity') or {}
    chat = str(job.get('chatId') or '')
    if job.get('template') in {
        'RENTAL_RETURN_CLIENT',
        'CLIENT_RENTAL_LIFECYCLE',
        'CLIENT_IMPOUND_ALERT',
        'CLIENT_GPS_EVENT',
        'CLIENT_REGIONAL_GEOFENCE_ALERT',
    }:
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
    if job.get("template") == "BOT_RENTAL_REQUEST_CREATED" and not payload.get("message"):
        request_id = escape(str(payload.get("requestId") or "не указан"))
        return (
            "📥 <b>Новая заявка на аренду</b>\n\n"
            "📄 <b>Заявка</b>\n"
            f"└ ID <code>{request_id}</code>\n\n"
            "⚡ <b>Действие</b>\n"
            "└ Открыть заявку и связаться с клиентом",
            "HTML",
        )
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
    payload = job.get("payload") or {}
    remember_digest(target, payload)
    markup = (
        client_main_menu()
        if payload.get("clientMenu") is True
        else notification_actions(payload.get("actions"))
    )
    kwargs = {}
    if parse_mode:
        kwargs["parse_mode"] = parse_mode
    if markup:
        kwargs["reply_markup"] = markup
    try:
        await bot.send_message(target, text, **kwargs)
    except TelegramBadRequest:
        if not markup:
            raise
        kwargs.pop("reply_markup", None)
        await bot.send_message(target, text, **kwargs)


async def notification_worker(bot, api, stop_event: asyncio.Event, staff_chat_id: int | None = None, worker_id: str = "supa-pro-bot", audience: str = "STAFF") -> None:
    while not stop_event.is_set():
        jobs = []
        try:
            jobs = (await api.claim_notifications(worker_id, audience)).get("items", [])
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
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=notification_poll_seconds(had_jobs=bool(jobs)),
            )
        except TimeoutError:
            continue
