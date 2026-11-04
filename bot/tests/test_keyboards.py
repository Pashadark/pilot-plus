from pathlib import Path

from aiogram.types import ReplyKeyboardMarkup

from bot.keyboards.client import client_main_menu, contact_keyboard, unresolved_rental_actions
from bot.keyboards.notifications import notification_actions
from bot.keyboards.rentals import extension_choices, staff_operation_actions
from bot.keyboards.staff import STAFF_MENU_LABELS, staff_main_menu


def test_client_menu_has_only_client_capabilities():
    labels = [button.text for row in client_main_menu().inline_keyboard for button in row]
    assert labels == [
        "🚗 Моя аренда",
        "📅 Продлить",
        "💰 Мой залог",
        "🧾 Мои штрафы",
        "📄 Мой договор",
        "💬 Связаться с менеджером",
    ]


def test_client_menu_uses_semantic_button_colors():
    rows = client_main_menu().inline_keyboard

    assert rows[0][0].style == "success"
    assert rows[0][1].style is None
    assert rows[1][0].style is None
    assert rows[1][1].style is None
    assert rows[2][0].style is None
    assert rows[2][1].style == "danger"


def test_unresolved_rental_actions_are_clear_and_colored():
    rows = unresolved_rental_actions().inline_keyboard

    assert [(button.text, button.style) for row in rows for button in row] == [
        ("💬 Связаться с менеджером", "danger"),
        ("🔄 Проверить ещё раз", "primary"),
    ]


def test_contact_confirmation_keyboard_stays_visible_until_contact_is_sent():
    markup = contact_keyboard()

    assert markup.resize_keyboard is True
    assert markup.is_persistent is True
    assert markup.one_time_keyboard is False
    assert markup.input_field_placeholder == "Нажмите кнопку подтверждения ниже"
    assert markup.keyboard[0][0].request_contact is True


def test_staff_menu_is_persistent_reply_keyboard_with_all_sections():
    markup = staff_main_menu()

    assert isinstance(markup, ReplyKeyboardMarkup)
    assert markup.resize_keyboard is True
    assert markup.is_persistent is True
    labels = [button.text for row in markup.keyboard for button in row]
    assert labels == ["Заявки", "Аренды", "Календарь", "Клиенты", "Автопарк", "Штрафы", "Помощь"]
    assert STAFF_MENU_LABELS == frozenset(labels)


def test_markup_imports_exist_only_in_keyboards_package():
    root = Path(__file__).parents[1]
    offenders = []
    for path in root.rglob("*.py"):
        if "keyboards" in path.parts or "tests" in path.parts or ".venv" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        if "InlineKeyboardButton" in text or "InlineKeyboardMarkup" in text:
            offenders.append(path.name)
    assert offenders == []


def test_extension_menu_contains_only_active_or_confirmed_own_rentals():
    markup = extension_choices([
        {"id": "r1", "status": "ACTIVE", "contractNumber": "ME-1", "vehicle": {"registrationNumber": "A001AA"}},
        {"id": "r2", "status": "CANCELLED", "contractNumber": "ME-2", "vehicle": {"registrationNumber": "B002BB"}},
    ])
    callbacks = [button.callback_data for row in markup.inline_keyboard for button in row]
    assert "rental:extend:r1" in callbacks
    assert "rental:extend:r2" not in callbacks


def test_staff_rental_actions_are_large_separate_rows():
    markup = staff_operation_actions({"id": "r1", "action": "RETURN"})

    assert [[button.text for button in row] for row in markup.inline_keyboard] == [
        ["Принять автомобиль"],
        ["Продлить аренду"],
    ]
    assert [[button.callback_data for button in row] for row in markup.inline_keyboard] == [
        ["staffop:RETURN:r1"],
        ["staffop:EXTENSION:r1"],
    ]


def test_notification_actions_build_safe_url_and_summary_callback_buttons():
    markup = notification_actions([
        {"type": "phone_url", "label": "📞 Позвонить", "url": "tel:+79991234567"},
        {"type": "contract_url", "label": "📄 Открыть договор", "url": "https://supapro.ru/rentals/r1"},
        {"type": "summary_section", "label": "🟠 Трекеры и GPS", "section": "trackers", "date": "2026-10-23"},
        {"type": "summary_refresh", "label": "🔄 Обновить", "date": "2026-10-23"},
    ])

    buttons = [button for row in markup.inline_keyboard for button in row]
    assert buttons[0].url == "tel:+79991234567"
    assert buttons[1].url == "https://supapro.ru/rentals/r1"
    assert buttons[2].callback_data == "notify:section:trackers:2026-10-23"
    assert buttons[3].callback_data == "notify:refresh:2026-10-23"
    assert all(len(button.callback_data.encode()) <= 64 for button in buttons if button.callback_data)
    assert [len(row) for row in markup.inline_keyboard] == [2, 1, 1]


def test_notification_actions_support_a_generic_supapro_open_button():
    markup = notification_actions([
        {"type": "open_url", "label": "Открыть в Supa Pro", "url": "https://supapro.ru/leads"},
    ])

    assert markup.inline_keyboard[0][0].text == "Открыть в Supa Pro"
    assert markup.inline_keyboard[0][0].url == "https://supapro.ru/leads"


def test_impound_actions_build_notify_and_phone_buttons():
    markup = notification_actions([
        {"type": "notify_client", "label": "✉️ Сообщить", "actionId": "rental-1"},
        {"type": "phone_url", "label": "📞 Позвонить", "url": "tel:+79991234567"},
    ])

    buttons = [button for row in markup.inline_keyboard for button in row]
    assert buttons[0].callback_data == "notify:client:rental-1:impound"
    assert buttons[1].url == "tel:+79991234567"


def test_fine_actions_keep_phone_and_decree_together_and_payment_full_width():
    markup = notification_actions([
        {"type": "phone_url", "label": "📞 Позвонить", "url": "tel:+79991234567"},
        {"type": "decree_url", "label": "📥 Скачать постановление", "url": "https://supapro.ru/fines?fineId=f1"},
        {"type": "payment_url", "label": "💳 Оплатить 562 ₽", "url": "https://supapro.ru/fines?fineId=f1"},
    ])

    assert [[button.text for button in row] for row in markup.inline_keyboard] == [
        ["📞 Позвонить", "📥 Скачать постановление"],
        ["💳 Оплатить 562 ₽"],
    ]


def test_notification_actions_hide_unknown_incomplete_and_unsafe_actions():
    assert notification_actions([
        {"type": "unknown", "label": "Неизвестно", "url": "https://example.com"},
        {"type": "map_url", "label": "Карта", "url": "javascript:alert(1)"},
        {"type": "summary_section", "label": "Клиент", "section": "personal-data"},
        {"type": "vehicle_block_confirm", "label": "Заблокировать"},
    ]) is None
