from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup

from .callbacks import CLIENT_EXTEND, CLIENT_NEW_RENTAL, CLIENT_RENTALS, COMMON_HELP


def contact_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="Подтвердить мой телефон", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def client_main_menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚗 Моя аренда", callback_data=CLIENT_RENTALS, style="primary"), InlineKeyboardButton(text="📅 Продлить", callback_data=CLIENT_EXTEND, style="success")],
        [InlineKeyboardButton(text="🧾 Мои штрафы", callback_data="client:fines:0"), InlineKeyboardButton(text="📄 Мой договор", callback_data="client:documents")],
        [InlineKeyboardButton(text="💬 Связаться с менеджером", callback_data=COMMON_HELP)],
    ])

def customer_back() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="← В меню", callback_data="client:menu")]])

def fine_actions(fine_id: str, paid: bool) -> InlineKeyboardMarkup:
    rows = [] if paid else [[InlineKeyboardButton(text="💳 Запросить ссылку на оплату", callback_data=f"client:pay:{fine_id}", style="primary")]]
    rows += [[InlineKeyboardButton(text="💬 Задать вопрос", callback_data=f"client:question:{fine_id}")], [InlineKeyboardButton(text="← В меню", callback_data="client:menu")]]
    return InlineKeyboardMarkup(inline_keyboard=rows)

def fines_navigation(page: int, more: bool) -> InlineKeyboardMarkup:
    rows = []
    if page > 0: rows.append([InlineKeyboardButton(text="← Предыдущие", callback_data=f"client:fines:{page-1}")])
    if more: rows.append([InlineKeyboardButton(text="Следующие →", callback_data=f"client:fines:{page+1}")])
    rows.append([InlineKeyboardButton(text="← В меню", callback_data="client:menu")])
    return InlineKeyboardMarkup(inline_keyboard=rows)
