from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo

MOSCOW = ZoneInfo("Europe/Moscow")

def remaining_time(ends_at: str, now: datetime | None = None) -> str:
    end = datetime.fromisoformat(ends_at.replace('Z','+00:00'))
    minutes = int((end - (now or datetime.now(MOSCOW))).total_seconds() // 60)
    overdue = minutes < 0
    days, rest = divmod(abs(minutes), 1440)
    hours, mins = divmod(rest, 60)
    duration = f'{days} дн. {hours} ч.' if days else f'{hours} ч. {mins} мин.'
    return ('Возврат просрочен на ' if overdue else 'Осталось: ') + duration


def rental_card(item: dict) -> str:
    start = datetime.fromisoformat(item["startsAt"].replace("Z", "+00:00")).astimezone(MOSCOW)
    end = datetime.fromisoformat(item["endsAt"].replace("Z", "+00:00")).astimezone(MOSCOW)
    vehicle = item["vehicle"]
    number = escape(str(item.get("contractNumber") or "Черновик"))
    title = escape(f"{vehicle.get('make', '')} {vehicle.get('model', '')}  {vehicle.get('registrationNumber', '')}")
    total = int(item["totalPriceMinor"]) // 100
    remaining = f"\n⏳ <b>{remaining_time(item['endsAt'])}</b>" if item.get('status') == 'ACTIVE' else ('\nАренда подтверждена' if item.get('status') == 'CONFIRMED' else '\nАренда завершена')
    return f"🚗 <b>{title}</b>\nДоговор {number}{remaining}\n📅 Начало: {start:%d.%m.%Y %H:%M} МСК\n📅 Возврат: {end:%d.%m.%Y %H:%M} МСК\nИтого: {total:,} ₽".replace(",", " ")
