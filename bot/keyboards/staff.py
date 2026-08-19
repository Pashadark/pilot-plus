from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from .callbacks import STAFF_REQUESTS


def staff_main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Заявки клиентов", callback_data=STAFF_REQUESTS)]])
