import { describe, expect, it } from 'vitest';

import { presentRentalListRow } from './rental-list-presentation';

const base = {
  id: 'rental-1',
  status: 'ACTIVE',
  startsAt: '2026-08-20T09:00:00.000Z',
  endsAt: '2026-08-24T09:00:00.000Z',
  contractNumber: 'ME-2026-0014',
  totalPriceMinor: BigInt(2_500_000),
  depositMinor: BigInt(10_000_000),
  currency: 'RUB',
  clientLabel: 'Филатов Илья',
  vehicleLabel: 'Kia Rio · Р604АО997',
  hasExtension: false,
  documentFormats: ['DOCX', 'PDF'],
  documents: [
    { format: 'DOCX', version: 2 },
    { format: 'PDF', version: 2 },
  ],
};

describe('представление договора в списке', () => {
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
    expect(
      presentRentalListRow(
        { ...base, endsAt: '2026-08-24T18:00:00.000Z' },
        new Date('2026-08-24T09:00:00.000Z'),
      ),
    ).toMatchObject({ label: 'Возврат', tone: 'warning', returnsToday: true });
  });
});
