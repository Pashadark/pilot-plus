from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def vehicle_choices(vehicles: list[dict]) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text=f"{v['make']} {v['model']} · {v['registrationNumber']}", callback_data=f"rental:vehicle:{v['id']}")] for v in vehicles]
    rows.append([InlineKeyboardButton(text="Отмена", callback_data="rental:cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def fulfillment_choices() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Заберу в офисе", callback_data="rental:mode:OFFICE")],
        [InlineKeyboardButton(text="Подача по адресу", callback_data="rental:mode:DELIVERY")],
        [InlineKeyboardButton(text="Отмена", callback_data="rental:cancel")],
    ])


def confirmation() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Отправить заявку", callback_data="rental:submit")],
        [InlineKeyboardButton(text="Отмена", callback_data="rental:cancel")],
    ])


def rental_documents(rental_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Скачать DOCX / PDF", callback_data=f"rental:documents:{rental_id}")]])


def document_links(items: list[dict]) -> InlineKeyboardMarkup:
    labels = ("Скачать DOCX", "Скачать PDF")
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=label, url=item["url"])]
        for label, item in zip(labels, items, strict=False)
    ])


def extension_choices(rentals: list[dict]) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(
            text=f"{item.get('contractNumber') or 'Договор'} · {item['vehicle']['registrationNumber']}",
            callback_data=f"rental:extend:{item['id']}",
        )]
        for item in rentals
        if item.get("status") in {"CONFIRMED", "ACTIVE"}
    ]
    rows.append([InlineKeyboardButton(text="Отмена", callback_data="rental:cancel")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def extension_confirmation() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Отправить продление", callback_data="rental:extend-submit")],
        [InlineKeyboardButton(text="Отмена", callback_data="rental:cancel")],
    ])


def staff_operation_choices(rentals: list[dict]) -> InlineKeyboardMarkup:
    rows = []
    for item in rentals:
        label = f"{item.get('contractNumber') or 'Без номера'} · {item['vehicle']['registrationNumber']}"
        if item["action"] == "HANDOVER":
            rows.append([InlineKeyboardButton(text=f"Выдать · {label}", callback_data=f"staffop:HANDOVER:{item['id']}")])
        else:
            rows.append([
                InlineKeyboardButton(text=f"Принять · {label}", callback_data=f"staffop:RETURN:{item['id']}"),
                InlineKeyboardButton(text="Продлить", callback_data=f"staffop:EXTENSION:{item['id']}"),
            ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def operation_choice(prefix: str, values: list[tuple[str, str]]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=label, callback_data=f"staffop:{prefix}:{value}")]
        for label, value in values
    ])


def operation_media_skip(kind: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Пропустить с причиной", callback_data=f"staffop:skip:{kind}")]
    ])


def operation_confirmation() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Подтвердить операцию", callback_data="staffop:confirm")],
        [InlineKeyboardButton(text="Отмена", callback_data="staffop:cancel")],
    ])
