import { describe, expect, it } from 'vitest';

import { presentRentalListRow } from './rental-list-presentation';

const base = {
  id: 'rental-1',
  clientId: 'client-1',
  vehicleId: 'vehicle-1',
  status: 'ACTIVE',
  agreementType: 'STANDARD' as const,
  startsAt: '2026-08-20T09:00:00.000Z',
  endsAt: '2026-08-24T09:00:00.000Z',
  completedAt: null,
  contractNumber: 'ME-2026-0014',
  dailyRateMinor: BigInt(470_000),
  totalPriceMinor: BigInt(2_500_000),
  depositMinor: BigInt(10_000_000),
  currency: 'RUB',
  clientLabel: 'Филатов Илья',
  clientPhone: '+7 999 123-45-67',
  vehicleName: 'Kia Rio',
  registrationNumber: 'Р604АО997',
  vehicleInternalNumber: 'CAR-014',
  vehicleCity: 'Москва',
  vehicleImage: { localPath: '/vehicles/vehicle-1/images/image-1', alt: 'Kia Rio' },
  hasExtension: false,
  payments: [
    { kind: 'RENT' as const, amountMinor: BigInt(2_500_000) },
    { kind: 'DEPOSIT' as const, amountMinor: BigInt(10_000_000) },
  ],
  depositStatus: 'COLLECTED' as const,
  depositWithheldMinor: null,
  documentFormats: ['DOCX', 'PDF'],
  documents: [
    { format: 'DOCX', version: 2 },
    { format: 'PDF', version: 2 },
  ],
};

describe('представление договора в списке', () => {
  it('marks a lease-to-own agreement without changing its lifecycle status', () => {
    expect(
      presentRentalListRow(
        { ...base, agreementType: 'LEASE_TO_OWN' },
        new Date('2026-08-23T12:00:00Z'),
      ),
    ).toMatchObject({ isLeaseToOwn: true, agreementTypeLabel: 'С правом выкупа' });
  });
  it('показывает продлённый активный договор жёлтым статусом', () => {
    expect(
      presentRentalListRow({ ...base, hasExtension: true }, new Date('2026-08-23T12:00:00Z')),
    ).toMatchObject({ lifecycle: 'EXTENDED', label: 'Продлён', tone: 'warning' });
  });

  it('показывает завершённый договор красным и форматирует деньги', () => {
    expect(
      presentRentalListRow(
        { ...base, status: 'COMPLETED', totalPriceMinor: BigInt(940_000) },
        new Date('2026-08-23T12:00:00Z'),
      ),
    ).toMatchObject({ lifecycle: 'COMPLETED', label: 'Закрыт', tone: 'danger', total: '9 400 ₽' });
  });

  it('показывает статус возврата, если активная аренда заканчивается сегодня по Москве', () => {
    const row = presentRentalListRow(
      { ...base, endsAt: '2026-08-24T18:00:00.000Z' },
      new Date('2026-08-24T09:00:00.000Z'),
    );

    expect(row).toMatchObject({
      label: 'Возврат сегодня',
      tone: 'warning',
      returnsToday: true,
      primaryAction: 'EXTEND',
      paymentLabel: 'Оплачено',
      depositLabel: 'Вернуть до 22.09.2026',
    });
    expect(row.remainingLabel).toMatch(/Осталось/u);
    expect(row.progressPercent).toBeGreaterThanOrEqual(0);
    expect(row.progressPercent).toBeLessThanOrEqual(100);
  });

  it('оставляет просроченную активную аренду активной и предлагает продление', () => {
    const row = presentRentalListRow(base, new Date('2026-08-25T12:00:00.000Z'));

    expect(row.lifecycle).toBe('ACTIVE');
    expect(row.label).toBe('Просрочен');
    expect(row.remainingLabel).toMatch(/Просрочено/u);
    expect(row.primaryAction).toBe('EXTEND');
  });

  it('показывает возврат залога из последней операции', () => {
    const row = presentRentalListRow(
      {
        ...base,
        status: 'COMPLETED',
        depositStatus: 'RETURNED',
        payments: [],
      },
      new Date('2026-08-25T12:00:00.000Z'),
    );

    expect(row.depositLabel).toContain('Возвращён');
  });

  it('считает созданный договор оплаченным и показывает договорной тариф за сутки', () => {
    const row = presentRentalListRow(
      { ...base, payments: [], totalPriceMinor: BigInt(940_000) },
      new Date('2026-08-23T12:00:00Z'),
    );

    expect(row).toMatchObject({
      paymentLabel: 'Оплачено',
      paymentPercent: 100,
      total: '9 400 ₽',
      dailyRate: '4 700 ₽/сутки',
    });
  });

  it('считает 21 рабочий день от фактического закрытия договора', () => {
    const row = presentRentalListRow(
      {
        ...base,
        status: 'COMPLETED',
        endsAt: '2026-08-20T09:00:00.000Z',
        completedAt: '2026-08-24T15:00:00.000Z',
      },
      new Date('2026-08-25T12:00:00.000Z'),
    );

    expect(row.depositLabel).toBe('Вернуть до 22.09.2026');
  });
});
