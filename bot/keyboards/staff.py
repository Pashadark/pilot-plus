from aiogram.types import KeyboardButton, ReplyKeyboardMarkup

STAFF_REQUESTS_TEXT = "Заявки"
STAFF_RENTALS_TEXT = "Аренды"
STAFF_CALENDAR_TEXT = "Календарь"
STAFF_CLIENTS_TEXT = "Клиенты"
STAFF_FLEET_TEXT = "Автопарк"
STAFF_FINES_TEXT = "Штрафы"
STAFF_HELP_TEXT = "Помощь"

STAFF_MENU_LABELS = frozenset(
    {
        STAFF_REQUESTS_TEXT,
        STAFF_RENTALS_TEXT,
        STAFF_CALENDAR_TEXT,
        STAFF_CLIENTS_TEXT,
        STAFF_FLEET_TEXT,
        STAFF_FINES_TEXT,
        STAFF_HELP_TEXT,
    }
)


def staff_main_menu() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=STAFF_REQUESTS_TEXT), KeyboardButton(text=STAFF_RENTALS_TEXT)],
            [KeyboardButton(text=STAFF_CALENDAR_TEXT), KeyboardButton(text=STAFF_CLIENTS_TEXT)],
            [KeyboardButton(text=STAFF_FLEET_TEXT), KeyboardButton(text=STAFF_FINES_TEXT)],
            [KeyboardButton(text=STAFF_HELP_TEXT)],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Выберите раздел Pilot+",
    )
