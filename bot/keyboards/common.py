from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def unlink_help() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Связаться с офисом", callback_data="client:help")]])
