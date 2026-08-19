from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from .callbacks import CLIENT_EXTEND, CLIENT_NEW_RENTAL, CLIENT_RENTALS, COMMON_HELP


def client_main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Новая аренда", callback_data=CLIENT_NEW_RENTAL)],
        [InlineKeyboardButton(text="Мои аренды", callback_data=CLIENT_RENTALS)],
        [InlineKeyboardButton(text="Продлить аренду", callback_data=CLIENT_EXTEND)],
        [InlineKeyboardButton(text="Помощь", callback_data=COMMON_HELP)],
    ])
