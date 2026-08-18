import { describe, expect, it } from 'vitest';

import { validateDriverHelperPaymentUrl } from './payment-url';

describe('validateDriverHelperPaymentUrl', () => {
  it('returns the safe HTTPS payment URL and hostname', () => {
    expect(validateDriverHelperPaymentUrl('https://pay.driver-helper.ru/invoices/abc')).toEqual({
      paymentUrl: 'https://pay.driver-helper.ru/invoices/abc',
      paymentHost: 'pay.driver-helper.ru',
    });
  });

  it.each([
    'http://pay.driver-helper.ru/invoices/abc',
    'https://user:password@pay.driver-helper.ru/invoices/abc',
    'https://pay.driver-helper.ru/invoices/abc?token=secret',
    'https://pay.driver-helper.ru/invoices/abc#secret',
    'https://payments.example.test/invoices/abc',
  ])('rejects unsafe or foreign payment URLs', (url) => {
    expect(validateDriverHelperPaymentUrl(url)).toBeNull();
  });
});
