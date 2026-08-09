import { describe, expect, it } from 'vitest';

import { normalizeRussianPhone } from '@/shared/utils/phone';

import { parseClientInput } from './validation';

function validFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values = {
    companyId: 'company-1',
    firstName: 'Анна',
    middleName: 'Сергеевна',
    lastName: 'Иванова',
    birthDate: '1994-05-20',
    phone: '+7 (999) 123-45-67',
    email: 'anna@example.com',
    passport: '4510 123456',
    driverLicense: '9910 123456',
    driverLicenseIssuedAt: '2020-01-01',
    driverLicenseExpiresAt: '2030-01-01',
    status: 'NEW',
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe('parseClientInput', () => {
  it('использует общий normalizer для российских номеров с 8 и +7', () => {
    expect(normalizeRussianPhone('8 (999) 123-45-67')).toBe('79991234567');
    expect(normalizeRussianPhone('+7 (999) 123-45-67')).toBe('79991234567');

    const result = parseClientInput(validFormData({ phone: '8 (999) 123-45-67' }));
    expect(result).toMatchObject({ ok: true, data: { phone: '79991234567' } });
  });

  it('преобразует валидную форму в типизированные данные клиента', () => {
    const result = parseClientInput(validFormData());

    expect(result).toMatchObject({
      ok: true,
      data: {
        companyId: 'company-1',
        firstName: 'Анна',
        middleName: 'Сергеевна',
        lastName: 'Иванова',
        phone: '79991234567',
        email: 'anna@example.com',
        passport: '4510 123456',
        driverLicense: '9910 123456',
        status: 'NEW',
      },
    });

    if (result.ok) {
      expect(result.data.birthDate).toEqual(new Date('1994-05-20T00:00:00.000Z'));
      expect(result.data.driverLicenseIssuedAt).toEqual(new Date('2020-01-01T00:00:00.000Z'));
      expect(result.data.driverLicenseExpiresAt).toEqual(new Date('2030-01-01T00:00:00.000Z'));
    }
  });

  it('отклоняет обязательные поля, невалидные контакты и несуществующие даты', () => {
    const result = parseClientInput(
      validFormData({
        firstName: ' ',
        lastName: '',
        phone: '12345',
        email: 'not-an-email',
        birthDate: '2026-02-30',
      }),
    );

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.fieldErrors).toMatchObject({
        firstName: expect.any(String),
        lastName: expect.any(String),
        phone: expect.any(String),
        email: expect.any(String),
        birthDate: expect.any(String),
      });
    }
  });

  it('требует, чтобы срок действия прав был позднее даты выдачи', () => {
    const result = parseClientInput(validFormData({ driverLicenseExpiresAt: '2020-01-01' }));

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.fieldErrors.driverLicenseExpiresAt).toBe(
        'Срок действия прав должен быть позднее даты выдачи.',
      );
    }
  });

  it('не позволяет форме напрямую установить архивный статус', () => {
    const result = parseClientInput(validFormData({ status: 'ARCHIVED' }));

    expect(result).toMatchObject({ ok: false });
  });
});
