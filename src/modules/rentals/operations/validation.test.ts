import { describe, expect, it } from 'vitest';

import {
  validateExtensionCommand,
  validateHandoverCommand,
  validateReturnCommand,
} from './validation';

describe('rental operation validation', () => {
  it('requires a reason whenever evidence is incomplete', () => {
    expect(() =>
      validateHandoverCommand({
        rentalId: 'rental-1',
        idempotencyKey: 'operation-1',
        occurredAt: '2026-08-21T12:00',
        fulfillmentMethod: 'OFFICE',
        mileageKm: 100,
        fuelLevelPercent: 75,
        evidenceStatus: 'VIDEO_MISSING',
        depositStatus: 'COLLECTED',
        depositAmountMinor: 50_000,
        depositPaymentMethod: 'CASH',
      }),
    ).toThrow('Причина отсутствия фиксации обязательна');
  });

  it('requires an address for delivery and converts Moscow local time to UTC', () => {
    const result = validateHandoverCommand({
      rentalId: 'rental-1',
      idempotencyKey: 'operation-1',
      occurredAt: '2026-08-21T12:00',
      fulfillmentMethod: 'DELIVERY',
      fulfillmentAddress: 'Москва, Зелёный проспект, 22',
      mileageKm: 100,
      fuelLevelPercent: 75,
      evidenceStatus: 'COMPLETE',
      depositStatus: 'COLLECTED',
      depositAmountMinor: 50_000,
      depositPaymentMethod: 'CASH',
    });
    expect(result.occurredAt.toISOString()).toBe('2026-08-21T09:00:00.000Z');
  });

  it('requires reasons for damage and withheld deposit', () => {
    expect(() =>
      validateReturnCommand({
        rentalId: 'rental-1',
        idempotencyKey: 'operation-2',
        occurredAt: '2026-08-21T12:00',
        mileageKm: 200,
        fuelLevelPercent: 50,
        evidenceStatus: 'COMPLETE',
        vehicleCondition: 'DAMAGE_RECORDED',
        depositStatus: 'WITHHELD',
        depositAmountMinor: 50_000,
        depositWithheldMinor: 50_000,
      }),
    ).toThrow('Опишите повреждения');
  });

  it('validates an extension command and rejects browser-controlled extra fields', () => {
    expect(
      validateExtensionCommand({
        rentalId: 'rental-1',
        idempotencyKey: 'operation-3',
        occurredAt: '2026-08-21T12:00',
        nextEndsAt: '2026-08-24T12:00',
      }),
    ).toMatchObject({
      rentalId: 'rental-1',
      occurredAt: new Date('2026-08-21T09:00:00.000Z'),
      nextEndsAt: new Date('2026-08-24T09:00:00.000Z'),
    });

    expect(() =>
      validateExtensionCommand({
        rentalId: 'rental-1',
        idempotencyKey: 'operation-3',
        occurredAt: '2026-08-21T12:00',
        nextEndsAt: '2026-08-24T12:00',
        companyId: 'attacker-company',
      } as never),
    ).toThrow('Неизвестное поле');
  });
});
