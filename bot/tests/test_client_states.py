from bot.messages.client_states import UNRESOLVED_RENTAL_TEXT, send_unresolved_rental


def run_immediate(coroutine):
    try:
        while True:
            coroutine.send(None)
    except StopIteration as result:
        return result.value


class RecordingMessage:
    def __init__(self, fail_photo=False):
        self.fail_photo = fail_photo
        self.photo_calls = []
        self.answer_calls = []

    async def answer_photo(self, **kwargs):
        self.photo_calls.append(kwargs)
        if self.fail_photo:
            raise RuntimeError("telegram media failed")

    async def answer(self, *args, **kwargs):
        self.answer_calls.append((args, kwargs))


def test_unresolved_rental_text_uses_the_shared_supapro_blocks():
    assert UNRESOLVED_RENTAL_TEXT.startswith("🔒 <b>Аренда не определена</b>")
    assert "👤 <b>Профиль</b>" in UNRESOLVED_RENTAL_TEXT
    assert "📍 <b>Статус</b>" in UNRESOLVED_RENTAL_TEXT
    assert "⚡ <b>Действие</b>" in UNRESOLVED_RENTAL_TEXT


def test_unresolved_rental_sends_compact_photo_with_actions():
    message = RecordingMessage()

    run_immediate(send_unresolved_rental(message))

    assert len(message.photo_calls) == 1
    assert message.photo_calls[0]["caption"] == UNRESOLVED_RENTAL_TEXT
    assert message.photo_calls[0]["parse_mode"] == "HTML"
    assert message.photo_calls[0]["reply_markup"].inline_keyboard[0][0].style == "danger"
    assert message.answer_calls == []


def test_unresolved_rental_falls_back_to_text():
    message = RecordingMessage(fail_photo=True)

    run_immediate(send_unresolved_rental(message))

    assert len(message.photo_calls) == 1
    assert message.answer_calls[0][0] == (UNRESOLVED_RENTAL_TEXT,)
    assert message.answer_calls[0][1]["parse_mode"] == "HTML"
