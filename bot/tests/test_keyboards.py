from pathlib import Path

from bot.keyboards.client import client_main_menu


def test_client_menu_has_only_client_capabilities():
    labels = [button.text for row in client_main_menu().inline_keyboard for button in row]
    assert labels == ["Новая аренда", "Мои аренды", "Продлить аренду", "Помощь"]


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
