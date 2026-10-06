from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo
MOSCOW = ZoneInfo('Europe/Moscow')

def fine_card(item: dict) -> str:
    paid = item.get('status') == 'PAID'
    cancelled = item.get('status') == 'CANCELLED'
    status = '🟢 Оплачен' if paid else 'Отменён' if cancelled else '🔴 Не оплачен'
    vehicle = item.get('vehicle') or {}
    title = ' '.join(str(vehicle.get(k) or '') for k in ('make','modelName','registrationNumber')).strip() or 'Автомобиль не указан'
    at = datetime.fromisoformat(item['offenseAt'].replace('Z','+00:00')).astimezone(MOSCOW)
    original = int(item['originalAmountMinor'])
    current = int(item['currentAmountMinor'])
    expires = datetime.fromisoformat(item['discountExpiresAt'].replace('Z','+00:00')).astimezone(MOSCOW) if item.get('discountExpiresAt') else None
    discount = not paid and not cancelled and current < original and expires and expires > datetime.now(MOSCOW)
    amount = current if paid or discount else max(current,original)
    money = lambda n: f'{n/100:,.2f}'.replace(',',' ').replace('.',',') + ' ₽'
    price = f'💰 <b>{money(amount)}</b>' + (f' <s>{money(original)}</s>\nСкидка до {expires:%d.%m.%Y %H:%M} МСК' if discount else '')
    return f'{status}\n🚗 <b>{escape(title)}</b>\n📋 {escape(item.get("description") or "Описание не предоставлено")}\n⚖️ Статья: {escape(item.get("articleCode") or "не указана")}\n📅 {at:%d.%m.%Y %H:%M} МСК\n📍 {escape(item.get("address") or "Место не указано")}\n📄 Постановление № {escape(item["decreeNumber"])}\n{price}'
