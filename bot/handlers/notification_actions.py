from aiogram import F, Router
from aiogram.types import CallbackQuery

from bot.keyboards.notifications import notification_actions
from bot.services.errors import PilotApiError
from bot.services.notifications import cached_digest_part


router = Router(name="notification_actions")


@router.callback_query(F.data.startswith("notify:section:"))
async def open_digest_section(callback: CallbackQuery) -> None:
    try:
        _, _, section, date = str(callback.data or "").split(":", 3)
    except ValueError:
        await callback.answer("Кнопка устарела", show_alert=True)
        return
    if not callback.message:
        await callback.answer("Сообщение недоступно", show_alert=True)
        return
    part = cached_digest_part(callback.message.chat.id, date, section)
    if not part:
        await callback.answer("Сводка устарела. Нажмите «Обновить». ", show_alert=True)
        return
    await callback.message.answer(
        part["message"],
        parse_mode="HTML",
        reply_markup=notification_actions(part.get("actions")),
    )
    await callback.answer()


@router.callback_query(F.data.startswith("notify:refresh:"))
async def refresh_digest(callback: CallbackQuery, pilot_api) -> None:
    date = str(callback.data or "").removeprefix("notify:refresh:")
    try:
        await pilot_api.refresh_operations_digest(str(callback.from_user.id), date)
    except PilotApiError:
        await callback.answer("Не удалось обновить сводку", show_alert=True)
        return
    await callback.answer("Обновляю сводку")


@router.callback_query(F.data.startswith("notify:remind:"))
async def remind_client(callback: CallbackQuery, pilot_api) -> None:
    rental_id = str(callback.data or "").removeprefix("notify:remind:")
    try:
        result = await pilot_api.remind_return(str(callback.from_user.id), rental_id)
    except PilotApiError as error:
        message = (
            "У клиента не привязан Telegram"
            if error.code == "CLIENT_TELEGRAM_NOT_LINKED"
            else "Не удалось отправить напоминание"
        )
        await callback.answer(message, show_alert=True)
        return
    await callback.answer(
        "Напоминание отправлено" if result.get("queued") else "Напоминание уже отправлено"
    )


@router.callback_query(F.data.startswith("notify:client:"))
async def notify_client(callback: CallbackQuery, pilot_api) -> None:
    parts = str(callback.data or "").split(":")
    if len(parts) != 4 or parts[3] != "impound":
        await callback.answer("Кнопка устарела", show_alert=True)
        return
    try:
        result = await pilot_api.notify_client_impound(str(callback.from_user.id), parts[2])
    except PilotApiError as error:
        message = (
            "У клиента не привязан Telegram"
            if error.code == "CLIENT_TELEGRAM_NOT_LINKED"
            else "Не удалось отправить сообщение"
        )
        await callback.answer(message, show_alert=True)
        return
    await callback.answer(
        "Сообщение отправлено" if result.get("queued") else "Сообщение уже отправлено"
    )
