from datetime import datetime, timezone
from bot.keyboards.client import client_main_menu
from bot.formatters.rentals import remaining_time

def test_menu_is_compact_and_client_only():
    rows = client_main_menu().inline_keyboard
    assert [len(row) for row in rows] == [2, 2, 2]
    assert [b.text for row in rows for b in row] == ['🚗 Моя аренда', '📅 Продлить', '💰 Мой залог', '🧾 Мои штрафы', '📄 Мой договор', '💬 Связаться с менеджером']
    assert rows[0][0].model_dump()['style'] == 'success'
    assert rows[0][1].model_dump()['style'] is None
    assert rows[2][1].model_dump()['style'] == 'danger'

def test_deposit_card_shows_balance_debt_and_return_deadline():
    from bot.formatters.deposits import deposit_card
    text = deposit_card({
        'contractNumber': 'ME-1', 'status': 'COMPLETED', 'currency': 'RUB',
        'initialMinor': '1000000', 'cashMinor': '1000000', 'reservedMinor': '115000',
        'withheldMinor': '0', 'availableMinor': '885000', 'debtMinor': '0',
        'returnDueOn': '2026-11-02',
        'vehicle': {'make': 'Kia', 'model': 'K5', 'registrationNumber': 'А001АА777'},
        'history': [{'kind': 'FINE_RESERVATION', 'reason': '<штраф>', 'reservedDeltaMinor': '115000', 'withheldDeltaMinor': '0', 'cashDeltaMinor': '0', 'debtDeltaMinor': '0', 'occurredAt': '2026-10-03T12:00:00Z'}],
    })
    assert 'Доступно: <b>8 850,00 ₽</b>' in text
    assert 'Вернуть до: <b>02.11.2026</b>' in text
    assert '&lt;штраф&gt;' in text

def test_remaining_time_uses_exact_duration_and_handles_overdue():
    now = datetime(2026,9,29,10,tzinfo=timezone.utc)
    assert remaining_time('2026-10-01T14:00:00Z', now) == 'Осталось: 2 дн. 4 ч.'
    assert remaining_time('2026-09-29T09:00:00Z', now) == 'Возврат просрочен на 1 ч. 0 мин.'
