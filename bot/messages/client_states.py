from aiogram.types import FSInputFile

from bot.keyboards.client import unresolved_rental_actions
from bot.presentation import asset_path


UNRESOLVED_RENTAL_TEXT = (
    "🔒 <b>Аренда не определена</b>\n\n"
    "👤 <b>Профиль</b>\n"
    "└ Телефон подтверждён\n\n"
    "📍 <b>Статус</b>\n"
    "└ Не удалось однозначно определить действующую аренду.\n\n"
    "⚡ <b>Действие</b>\n"
    "└ Свяжитесь с менеджером — он проверит договор и привязку автомобиля."
)


async def send_unresolved_rental(message) -> None:
    markup = unresolved_rental_actions()
    try:
        await message.answer_photo(
            photo=FSInputFile(asset_path("client-rental-closed.png")),
            caption=UNRESOLVED_RENTAL_TEXT,
            parse_mode="HTML",
            reply_markup=markup,
        )
    except Exception as error:
        print(f"client_state_media_fallback={type(error).__name__}", flush=True)
        await message.answer(
            UNRESOLVED_RENTAL_TEXT,
            parse_mode="HTML",
            reply_markup=markup,
        )
