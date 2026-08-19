from bot.formatters.rentals import rental_card


def test_rental_card_escapes_pii_and_formats_moscow_time():
    text = rental_card({"contractNumber": "<ME-1>", "startsAt": "2026-09-01T06:00:00Z", "endsAt": "2026-09-02T06:00:00Z", "totalPriceMinor": "120000", "vehicle": {"make": "Kia", "model": "K5", "registrationNumber": "A001AA"}})
    assert "&lt;ME-1&gt;" in text
    assert "01.09.2026 09:00" in text
    assert "1 200 ₽" in text
