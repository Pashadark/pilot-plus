import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClientFineWorkspace } from './ClientFineWorkspace';

describe('ClientFineWorkspace', () => {
  it('shows decree, vehicle, offense and confirmed driving period', () => {
    const markup = renderToStaticMarkup(
      createElement(ClientFineWorkspace, {
        clientId: 'client-1',
        workspace: {
          summary: { total: 1, unpaid: 1, unpaidAmountMinor: '56250' },
          fines: [
            {
              id: 'fine-1',
              decreeNumber: '18810550260831038048',
              decreeAt: '2026-08-28T09:00:00.000Z',
              offenseAt: '2026-08-27T10:29:00.000Z',
              currentAmountMinor: '56250',
              originalAmountMinor: '75000',
              status: 'UNPAID',
              description: 'Превышение скорости движения ТС от 20 до 40 км/ч',
              articleCode: '12.9 ч.2',
              address: 'М-5 «Урал», 118 км + 470 м',
              assignmentConfirmedAt: '2026-08-29T08:00:00.000Z',
              assignmentSource: 'MANUAL',
              vehicle: {
                id: 'vehicle-1',
                label: 'Mercedes-Benz E 220 d 4MATIC',
                registrationNumber: 'М283АМ997',
              },
              rental: {
                id: 'rental-1',
                contractNumber: 'ME-2026-0061-VK',
                startsAt: '2026-08-25T08:00:00.000Z',
                endsAt: '2026-08-30T16:00:00.000Z',
              },
            },
          ],
        },
      }),
    );

    expect(markup).toContain('18810550260831038048');
    expect(markup).toContain('Дата постановления');
    expect(markup).toContain('Дата нарушения');
    expect(markup).toContain('Mercedes-Benz E 220 d 4MATIC');
    expect(markup).toContain('ME-2026-0061-VK');
    expect(markup).toContain('Клиент ехал');
    expect(markup).toContain('Подтверждено менеджером');
  });

  it('shows a clear empty state when the client has no linked fines', () => {
    const markup = renderToStaticMarkup(
      createElement(ClientFineWorkspace, {
        clientId: 'client-1',
        workspace: {
          summary: { total: 0, unpaid: 0, unpaidAmountMinor: '0' },
          fines: [],
        },
      }),
    );

    expect(markup).toContain('У клиента нет привязанных штрафов');
  });
});
