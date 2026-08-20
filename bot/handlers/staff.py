from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from bot.keyboards.callbacks import STAFF_REQUESTS
from bot.formatters.operations import fleet_text, requests_text
from bot.keyboards.staff import (
    STAFF_CALENDAR_TEXT,
    STAFF_CLIENTS_TEXT,
    STAFF_FINES_TEXT,
    STAFF_FLEET_TEXT,
    STAFF_HELP_TEXT,
    STAFF_MENU_LABELS,
    STAFF_RENTALS_TEXT,
    STAFF_REQUESTS_TEXT,
    staff_main_menu,
)
from bot.services.errors import PilotApiError

router = Router(name="staff")

SECTION_RESPONSES = {
    STAFF_REQUESTS_TEXT: "Заявки клиентов пока готовятся. Новые заявки будут появляться здесь.",
    STAFF_RENTALS_TEXT: "Раздел аренды в Telegram готовится. Все договоры доступны в Pilot+.",
    STAFF_CALENDAR_TEXT: "Календарь в Telegram готовится. Расписание доступно в Pilot+.",
    STAFF_CLIENTS_TEXT: "Раздел клиентов в Telegram готовится. Карточки доступны в Pilot+.",
    STAFF_FLEET_TEXT: "Автопарк в Telegram готовится. Машины доступны в Pilot+.",
    STAFF_FINES_TEXT: "Штрафы в Telegram готовятся. Актуальный список доступен в Pilot+.",
    STAFF_HELP_TEXT: "Pilot+ поможет с заявками, арендами, клиентами, автопарком и штрафами.",
}


async def staff_access(telegram_user_id: int, pilot_api) -> str:
    try:
        profile = await pilot_api.profile(str(telegram_user_id))
    except PilotApiError:
        return "unavailable"
    return "allowed" if profile.get("kind") == "STAFF" else "forbidden"


@router.message(Command("pilot_setup"))
async def bind_work_group(message: Message, pilot_api) -> None:
    if not message.from_user:
        return
    chat_type = getattr(message.chat.type, "value", message.chat.type)
    if chat_type not in {"group", "supergroup"}:
        await message.answer("Добавьте бота в рабочую группу и выполните там /pilot_setup.")
        return
    try:
        await pilot_api.bind_work_group(
            str(message.from_user.id), str(message.chat.id), str(chat_type), message.chat.title
        )
    except PilotApiError as error:
        if error.code == "FORBIDDEN":
            await message.answer("Привязать группу может администратор или диспетчер Pilot+.")
        else:
            await message.answer("Не удалось привязать группу. Проверьте доступ и повторите.")
        return
    await message.answer("Группа Pilot+ привязана. Сюда будут приходить ежедневные сводки.")


@router.message(F.text.in_(STAFF_MENU_LABELS))
async def staff_menu_action(message: Message, pilot_api) -> None:
    if not message.from_user:
        return
    access = await staff_access(message.from_user.id, pilot_api)
    if access == "unavailable":
        await message.answer("Не удалось связаться с Pilot+. Попробуйте ещё раз.")
        return
    if access == "forbidden":
        await message.answer("Этот раздел доступен только сотрудникам Pilot+.")
        return
    if message.text in {STAFF_REQUESTS_TEXT, STAFF_FLEET_TEXT}:
        try:
            operations = await pilot_api.daily_operations(str(message.from_user.id))
        except PilotApiError:
            await message.answer("Не удалось загрузить данные Pilot+. Попробуйте ещё раз.", reply_markup=staff_main_menu())
            return
        text = requests_text(operations) if message.text == STAFF_REQUESTS_TEXT else fleet_text(operations)
        await message.answer(text, reply_markup=staff_main_menu())
        return
    await message.answer(SECTION_RESPONSES[message.text], reply_markup=staff_main_menu())


@router.callback_query(F.data == STAFF_REQUESTS)
async def legacy_staff_requests(callback: CallbackQuery, pilot_api) -> None:
    try:
        access = await staff_access(callback.from_user.id, pilot_api)
        if callback.message:
            if access == "unavailable":
                await callback.message.answer("Не удалось связаться с Pilot+. Попробуйте ещё раз.")
            elif access == "forbidden":
                await callback.message.answer("Этот раздел доступен только сотрудникам Pilot+.")
            else:
                await callback.message.answer(
                    SECTION_RESPONSES[STAFF_REQUESTS_TEXT], reply_markup=staff_main_menu()
                )
    finally:
        await callback.answer()


@router.message()
async def staff_unknown_message(message: Message, pilot_api) -> None:
    if not message.from_user:
        return
    if await staff_access(message.from_user.id, pilot_api) == "allowed":
        await message.answer("Выберите раздел в меню Pilot+.", reply_markup=staff_main_menu())
