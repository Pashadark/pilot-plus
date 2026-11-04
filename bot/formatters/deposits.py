from datetime import datetime
from html import escape


def _money(value: str | int) -> str:
    minor = int(value)
    return f"{minor / 100:,.2f}".replace(",", " ").replace(".", ",") + " ₽"


def _date(value: str) -> str:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%d.%m.%Y")


def _history_amount(entry: dict) -> str:
    values = (
        int(entry.get("cashDeltaMinor", 0)),
        int(entry.get("reservedDeltaMinor", 0)),
        int(entry.get("withheldDeltaMinor", 0)),
        int(entry.get("debtDeltaMinor", 0)),
    )
    amount = next((value for value in values if value), 0)
    return ("+" if amount > 0 else "") + _money(amount)


def deposit_card(item: dict) -> str:
    vehicle = item.get("vehicle", {})
    title = " ".join(filter(None, [vehicle.get("make"), vehicle.get("model")]))
    history = item.get("history", [])[:5]
    history_lines = [
        f"• {_date(entry['occurredAt'])} · {escape(str(entry.get('reason') or entry.get('kind') or 'Операция'))} · <b>{_history_amount(entry)}</b>"
        for entry in history
    ]
    if len(item.get("history", [])) > 5:
        history_lines.append(f"• Ещё операций: {len(item['history']) - 5}")
    return "\n".join([
        "💰 <b>Мой залог</b>",
        f"{escape(title)} · <code>{escape(str(vehicle.get('registrationNumber') or '—'))}</code>",
        f"Договор: <b>{escape(str(item.get('contractNumber') or 'без номера'))}</b>",
        "",
        f"Первоначальный залог: <b>{_money(item.get('initialMinor', 0))}</b>",
        f"Внесено: <b>{_money(item.get('cashMinor', 0))}</b>",
        f"Зарезервировано: <b>{_money(item.get('reservedMinor', 0))}</b>",
        f"Удержано: <b>{_money(item.get('withheldMinor', 0))}</b>",
        f"Доступно: <b>{_money(item.get('availableMinor', 0))}</b>",
        f"Задолженность: <b>{_money(item.get('debtMinor', 0))}</b>",
        f"Вернуть до: <b>{_date(item['returnDueOn'])}</b>",
        "",
        "<b>Последние операции</b>",
        *(history_lines or ["• Операций пока нет"]),
    ])
