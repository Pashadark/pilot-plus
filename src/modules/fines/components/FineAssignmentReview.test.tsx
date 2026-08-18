import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FineAssignmentReview } from './FineAssignmentReview';

describe('FineAssignmentReview', () => {
  it('does not present an attribution candidate as a confirmed assignment', () => {
    const markup = renderToStaticMarkup(
      <FineAssignmentReview
        companyId="company-a"
        fineId="fine-a"
        canManage
        candidates={[
          {
            rentalId: 'rental-a',
            contractNumber: 'ME-2026-0001-AA',
            clientDisplayName: 'Иванова Анна',
            startsAt: '2026-08-16T09:00:00.000Z',
            endsAt: '2026-08-16T11:00:00.000Z',
            distanceLabel: 'Во время нарушения',
          },
        ]}
      />,
    );

    expect(markup).toContain('Возможный клиент — требуется подтверждение');
    expect(markup).toContain('Договор ME-2026-0001-AA');
    expect(markup).toContain('Во время нарушения');
    expect(markup).toContain('Подтвердить клиента');
    expect(markup).toContain('Снять привязку');
    expect(markup).not.toContain('Клиент подтверждён');
  });
});
