from html import escape

from aiogram import Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import Message

from bot.keyboards.client import client_main_menu
from bot.keyboards.staff import staff_main_menu
from bot.services.errors import PilotApiError

router = Router(name="start")


@router.message(CommandStart())
async def start(message: Message, command: CommandObject, pilot_api) -> None:
    if not message.from_user:
        return
    telegram_id = str(message.from_user.id)
    try:
        if command.args:
            await pilot_api.link_identity(command.args, telegram_id)
        profile = await pilot_api.profile(telegram_id)
    except PilotApiError:
        await message.answer("Бот ещё не привязан. Попросите персональную ссылку у сотрудника СУПА ПРО.")
        return
    name = escape(str(profile.get("displayName") or "клиент"))
    markup = client_main_menu() if profile.get("kind") == "CLIENT" else staff_main_menu()
    await message.answer(f"Здравствуйте, {name}! Выберите действие:", reply_markup=markup)
