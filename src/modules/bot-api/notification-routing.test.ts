import { describe, expect, it } from 'vitest';
import { notificationDestination } from './notification-routing';

const job = { companyId: 'a', template: 'LEAD_CREATED', chatId: '-123', identity: null };
describe('notification recipient isolation', () => {
  it('allows only the bound company group', () => {
    expect(notificationDestination(job, '-123')).toBe('-123');
    expect(notificationDestination(job, '-456')).toBeNull();
    expect(notificationDestination(job, null)).toBeNull();
  });
  it('routes Timeweb billing alerts only to the bound internal group', () => {
    const billing = { ...job, template: 'SYSTEM_BILLING_ALERT' };
    expect(notificationDestination(billing, '-123')).toBe('-123');
    expect(notificationDestination(billing, '-456')).toBeNull();
    expect(
      notificationDestination(
        {
          ...billing,
          identity: {
            kind: 'CLIENT',
            companyId: 'a',
            clientId: 'client-a',
            isActive: true,
            telegramUserId: '123',
          },
        },
        '-123',
      ),
    ).toBeNull();
  });
  it('resolves legacy destinations only against their own company binding', () => {
    expect(notificationDestination({ ...job, chatId: 'staff:a' }, '-123')).toBe('-123');
    expect(notificationDestination({ ...job, chatId: 'staff:b' }, '-123')).toBeNull();
  });
  it('rejects internal notifications to any personal identity and unknown templates', () => {
    expect(
      notificationDestination(
        {
          ...job,
          identity: {
            kind: 'CLIENT',
            companyId: 'a',
            clientId: 'c',
            isActive: true,
            telegramUserId: '123',
          },
        },
        '-123',
      ),
    ).toBeNull();
    expect(notificationDestination({ ...job, template: 'UNKNOWN' }, '-123')).toBeNull();
  });
  it('requires active same-company customers and forbids group destinations', () => {
    const customer = {
      ...job,
      template: 'RENTAL_RETURN_CLIENT',
      chatId: null,
      identity: {
        kind: 'CLIENT',
        companyId: 'a',
        clientId: 'c',
        isActive: true,
        telegramUserId: '123',
      },
    };
    expect(notificationDestination(customer, null)).toBe('123');
    expect(notificationDestination({ ...customer, chatId: '-123' }, '-123')).toBeNull();
    expect(
      notificationDestination({ ...customer, template: 'CLIENT_GPS_EVENT' }, null),
    ).toBe('123');
    expect(
      notificationDestination(
        { ...customer, identity: { ...customer.identity, companyId: 'b' } },
        null,
      ),
    ).toBeNull();
    expect(
      notificationDestination(
        { ...customer, identity: { ...customer.identity, isActive: false } },
        null,
      ),
    ).toBeNull();
  });
});
