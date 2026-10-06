from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from bot.handlers.customer import show_client_home, question
from bot.services.errors import PilotApiError

@pytest.mark.asyncio
async def test_home_never_queries_data_in_groups():
    api=SimpleNamespace(rentals=AsyncMock())
    await show_client_home(SimpleNamespace(chat=SimpleNamespace(type='group')),api,'123')
    api.rentals.assert_not_called()

@pytest.mark.asyncio
async def test_failed_question_remains_for_retry_and_never_claims_sent():
    message=SimpleNamespace(text='Вопрос',from_user=SimpleNamespace(id=123),message_id=4,answer=AsyncMock())
    state=AsyncMock()
    state.get_data.return_value={'fine_id':'f1'}
    api=SimpleNamespace(support=AsyncMock(side_effect=PilotApiError('NOT_FOUND',404)))
    await question(message,state,api)
    state.clear.assert_not_called()
    assert 'Не удалось' in message.answer.call_args.args[0]

def test_fine_text_escapes_html_and_shows_dates_and_number():
    from bot.formatters.fines import fine_card
    text=fine_card({'status':'UNPAID','description':'<парковка>','articleCode':'8.14','offenseAt':'2026-09-28T10:29:00Z','decreeNumber':'123','originalAmountMinor':'500000','currentAmountMinor':'500000','vehicle':{'make':'Kia','modelName':'Rio','registrationNumber':'Р604АО997'}})
    assert '&lt;парковка&gt;' in text and '28.09.2026 13:29 МСК' in text and '№ 123' in text
