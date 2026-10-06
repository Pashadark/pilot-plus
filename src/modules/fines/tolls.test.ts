import { describe, expect, it } from 'vitest';
import { parseTollDate, mapTollDebt } from './tolls';

const trip = {
  id: 1,
  road: 'ckad',
  place: 'М-12',
  amount: 4052,
  travelDate: '2026-09-22 14:00:01',
  lastCheckDate: '2026-09-23 10:57:33',
  carRegnum: 'A123AA777',
  carTitle: 'Polo',
  carId: 1,
  uin: '',
};
const vehicle = { id: 'v1', companyId: 'c1', registrationNumber: 'А123АА777' };
const rental = {
  id: 'r1',
  companyId: 'c1',
  vehicleId: 'v1',
  clientId: 'p1',
  contractNumber: '59',
  startsAt: new Date('2026-09-22T11:00:00Z'),
  endsAt: new Date('2026-09-25T11:00:00Z'),
  client: { lastName: 'Иванов', firstName: 'Иван', middleName: null },
};
describe('toll debt mapping', () => {
  it('reads provider times as Moscow time with seconds', () => {
    expect(parseTollDate(trip.travelDate)?.toISOString()).toBe('2026-09-22T11:00:01.000Z');
    expect(parseTollDate('2026-02-31 12:00:00')).toBeNull();
    expect(parseTollDate('')).toBeNull();
  });
  it('matches plate and rental and preserves money', () => {
    expect(mapTollDebt('c1', trip, [vehicle], [rental])).toMatchObject({
      kind: 'TOLL',
      roadLabel: 'ЦКАД / Автодор',
      currentAmountMinor: '405200',
      clientLabel: 'Иванов Иван',
      rentalId: 'r1',
      decreeNumber: '',
      vehicleId: 'v1',
    });
  });
  it('does not assign another tenant or ambiguous rental', () => {
    expect(mapTollDebt('c2', trip, [vehicle], [rental])?.clientLabel).toBeNull();
    expect(
      mapTollDebt('c1', trip, [vehicle], [rental, { ...rental, id: 'r2' }])?.clientLabel,
    ).toBeNull();
  });
  it('uses half-open rental intervals and rejects invalid debt', () => {
    expect(
      mapTollDebt('c1', { ...trip, travelDate: '2026-09-25 14:00:00' }, [vehicle], [rental])
        ?.clientLabel,
    ).toBeNull();
    expect(mapTollDebt('c1', { ...trip, amount: -1 }, [vehicle], [rental])).toBeNull();
  });
});
