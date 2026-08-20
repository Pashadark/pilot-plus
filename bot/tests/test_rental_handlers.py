from datetime import datetime

from bot.handlers.rentals import MOSCOW, parse_moscow


def test_parse_moscow_rejects_impossible_dates_and_is_timezone_aware():
    assert parse_moscow("30.02.2027 10:00") is None
    parsed = parse_moscow("01.09.2027 10:30")
    assert parsed == datetime(2027, 9, 1, 10, 30, tzinfo=MOSCOW)
