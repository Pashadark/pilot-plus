import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FinesPage } from './FinesPage';

describe('FinesPage', () => {
  it('renders a fine with vehicle, amount, status and photo action', () => {
    const markup = renderToStaticMarkup(
      <FinesPage
        summary={{ newCount: 1, unpaidCount: 1, unpaidAmountMinor: '25000', unassignedCount: 0 }}
        fines={[
          {
            id: 'fine-a',
            decreeNumber: '18810150210001234567',
            offenseAt: '2026-08-16T09:30:00.000Z',
            currentAmountMinor: '25000',
            originalAmountMinor: '50000',
            status: 'UNPAID',
            description: 'Превышение скорости',
            address: 'Москва',
            vehicleLabel: 'Kia Cee’d · А429АУ97',
            clientLabel: 'Барышева Кристина',
            photoAvailable: true,
          },
        ]}
      />,
    );

    expect(markup).toContain('Штрафы');
    expect(markup).toContain('Kia Cee’d · А429АУ97');
    expect(markup).toMatch(/250\s₽/u);
    expect(markup).toContain('Не оплачен');
    expect(markup).toContain('Посмотреть фото');
    expect(markup).toContain('href="/fines/fine-a/photo"');
  });
});
