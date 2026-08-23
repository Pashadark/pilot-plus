from pathlib import Path

from aiogram.types import ReplyKeyboardMarkup

from bot.keyboards.client import client_main_menu
from bot.keyboards.rentals import extension_choices, staff_operation_actions
from bot.keyboards.staff import STAFF_MENU_LABELS, staff_main_menu


def test_client_menu_has_only_client_capabilities():
    labels = [button.text for row in client_main_menu().inline_keyboard for button in row]
    assert labels == ["Новая аренда", "Мои аренды", "Продлить аренду", "Помощь"]


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
        if "keyboards" in path.parts or "tests" in path.parts:
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
