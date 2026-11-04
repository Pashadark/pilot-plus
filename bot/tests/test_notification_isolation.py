import pytest
from bot.services.notifications import notification_target

def test_internal_messages_require_explicit_group_and_no_identity():
    assert notification_target({'template': 'LEAD_CREATED', 'chatId': '-123'}) == -123
    for job in [
        {'template': 'LEAD_CREATED', 'chatId': 'staff:c'},
        {'template': 'LEAD_CREATED', 'chatId': '123'},
        {'template': 'LEAD_CREATED', 'chatId': '-123', 'identity': {'telegramUserId': '123'}},
    ]:
        with pytest.raises(ValueError):
            notification_target(job)

def test_customer_requires_active_same_company_identity():
    job = {'companyId': 'c', 'template': 'RENTAL_RETURN_CLIENT', 'identity': {'kind': 'CLIENT', 'companyId': 'c', 'clientId': 'cl', 'isActive': True, 'telegramUserId': '123'}}
    assert notification_target(job) == 123
    for change in [{'isActive': False}, {'companyId': 'other'}, {'kind': 'STAFF'}]:
        with pytest.raises(ValueError):
            notification_target({**job, 'identity': {**job['identity'], **change}})

def test_impound_customer_alert_uses_the_same_strict_identity_scope():
    job = {'companyId': 'c', 'template': 'CLIENT_IMPOUND_ALERT', 'identity': {'kind': 'CLIENT', 'companyId': 'c', 'clientId': 'cl', 'isActive': True, 'telegramUserId': '123'}}
    assert notification_target(job) == 123
