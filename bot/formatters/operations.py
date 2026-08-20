from datetime import datetime
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
