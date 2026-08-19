from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo

MOSCOW = ZoneInfo("Europe/Moscow")


def rental_card(item: dict) -> str:
    start = datetime.fromisoformat(item["startsAt"].replace("Z", "+00:00")).astimezone(MOSCOW)
    end = datetime.fromisoformat(item["endsAt"].replace("Z", "+00:00")).astimezone(MOSCOW)
    vehicle = item["vehicle"]
    number = escape(str(item.get("contractNumber") or "Черновик"))
    title = escape(f"{vehicle.get('make', '')} {vehicle.get('model', '')} · {vehicle.get('registrationNumber', '')}")
    total = int(item["totalPriceMinor"]) // 100
    return f"<b>{number}</b>\n{title}\n{start:%d.%m.%Y %H:%M} — {end:%d.%m.%Y %H:%M}\nИтого: {total:,} ₽".replace(",", " ")
