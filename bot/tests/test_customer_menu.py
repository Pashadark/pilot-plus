from datetime import datetime, timezone
from bot.keyboards.client import client_main_menu
from bot.formatters.rentals import remaining_time

def test_menu_is_compact_and_client_only():
    rows = client_main_menu().inline_keyboard
    assert [len(row) for row in rows] == [2, 2, 1]
    assert [b.text for row in rows for b in row] == ['🚗 Моя аренда', '📅 Продлить', '🧾 Мои штрафы', '📄 Мой договор', '💬 Связаться с менеджером']
    assert rows[0][0].model_dump()['style'] == 'primary'

def test_remaining_time_uses_exact_duration_and_handles_overdue():
    now = datetime(2026,9,29,10,tzinfo=timezone.utc)
    assert remaining_time('2026-10-01T14:00:00Z', now) == 'Осталось: 2 дн. 4 ч.'
    assert remaining_time('2026-09-29T09:00:00Z', now) == 'Возврат просрочен на 1 ч. 0 мин.'
