from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo


def _time(value: str) -> str:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(ZoneInfo("Europe/Moscow")).strftime("%H:%M")


def _car(value: dict) -> str:
    title = " ".join(part for part in (value.get("make"), value.get("model")) if part)
    return f"{title} · {value.get('registrationNumber') or 'без номера'}"


def requests_text(data: dict) -> str:
    items = data.get("requests") or []
    if not items:
        return "Заявок на сегодня нет."
    lines = [f"Заявки на {data.get('date')}:"]
    for item in items:
        mode = "подача" if item.get("fulfillmentMode") == "DELIVERY" else "выдача в офисе"
        vehicle = _car(item["preferredVehicle"]) if item.get("preferredVehicle") else "машина не выбрана"
        lines.append(f"• {_time(item['startsAt'])} · {item['clientName']} · {mode}\n  {vehicle}")
    return "\n".join(lines)


def fleet_text(data: dict) -> str:
    free = data.get("freeVehicles") or []
    unavailable = data.get("unavailableVehicles") or []
    lines = [f"Автопарк на {data.get('date')}", f"Свободно: {len(free)}"]
    lines.extend(f"• {_car(item)}" for item in free)
    if unavailable:
        lines.append(f"На ТО / недоступны: {len(unavailable)}")
        lines.extend(f"• {_car(item)}" for item in unavailable)
    return "\n".join(lines)


def staff_rental_card(item: dict) -> str:
    start = datetime.fromisoformat(item["startsAt"].replace("Z", "+00:00")).astimezone(ZoneInfo("Europe/Moscow"))
    end = datetime.fromisoformat(item["endsAt"].replace("Z", "+00:00")).astimezone(ZoneInfo("Europe/Moscow"))
    vehicle = item["vehicle"]
    vehicle_title = " ".join(part for part in (vehicle.get("make"), vehicle.get("model")) if part)
    action = "Ожидает возврата" if item.get("action") == "RETURN" else "Ожидает выдачи"
    return "\n".join(
        (
            f"<b>{escape(str(item.get('clientName') or 'Клиент не указан'))}</b>",
            f"🚗 {escape(vehicle_title)} · <b>{escape(str(vehicle.get('registrationNumber') or 'без номера'))}</b>",
            f"📄 {escape(str(item.get('contractNumber') or 'Договор без номера'))}",
            f"🗓 {start:%d.%m.%Y %H:%M} — {end:%d.%m.%Y %H:%M}",
            f"Статус: <b>{action}</b>",
        )
    )
