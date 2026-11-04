import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DepositsWorkspace } from './DepositsWorkspace';

const row = {
  id: 'rental-1',
  companyId: 'company-1',
  clientId: 'client-1',
  clientName: 'Божко Иван Иванович',
  vehicleName: 'Kia Cerato',
  registrationNumber: 'С886АУ997',
  contractNumber: 'ME-2026-0087-ODI',
  rentalStatus: 'COMPLETED',
  currency: 'RUB',
  initialMinor: 50_000n,
  cashMinor: 50_000n,
  reservedMinor: 10_000n,
  withheldMinor: 5_000n,
  availableMinor: 35_000n,
  debtMinor: 0n,
  returnDueOn: '2026-10-21',
  status: 'TODAY' as const,
  searchText: 'божкоиванивановичkiaceratoс886ау997me20260087odi',
  history: [
    {
      id: 'entry-1',
      kind: 'FINE_RESERVATION',
      reason: 'Штраф №123',
      cashDeltaMinor: 0n,
      reservedDeltaMinor: 10_000n,
      withheldDeltaMinor: 0n,
      debtDeltaMinor: 0n,
      occurredAt: new Date('2026-10-20T09:00:00.000Z'),
    },
  ],
};

describe('DepositsWorkspace', () => {
  it('renders summary, filters, operational row and ledger history', () => {
    const markup = renderToStaticMarkup(
      <DepositsWorkspace
        rows={[row]}
        summary={{
          availableMinor: 35_000n,
          reservedMinor: 10_000n,
          withheldMinor: 5_000n,
          debtMinor: 0n,
          urgentCount: 1,
        }}
        query=""
        filter="all"
      />,
    );

    expect(markup).toContain('Залоги');
    expect(markup).toContain('Доступно к возврату');
    expect(markup).toContain('Срочно и скоро');
    expect(markup).toContain('Божко Иван Иванович');
    expect(markup).toContain('С886АУ997');
    expect(markup).toContain('ME-2026-0087-ODI');
    expect(markup).toContain('Сегодня');
    expect(markup).toContain('Штраф №123');
    expect(markup).toContain('href="/rentals/rental-1"');
  });
});
