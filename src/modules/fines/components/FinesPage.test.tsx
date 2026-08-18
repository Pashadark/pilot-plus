import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FinesPage } from './FinesPage';

describe('FinesPage', () => {
  it('renders a fine with vehicle, amount, status and photo action', () => {
    const markup = renderToStaticMarkup(
      <FinesPage
        companies={[{ id: 'company-a', name: 'Компания А' }]}
        selectedCompanyId="company-a"
        canSync
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

  it('renders all payment-risk KPI labels without payment controls for a dispatcher', () => {
    const markup = renderToStaticMarkup(
      <FinesPage
        companies={[{ id: 'company-a', name: 'Компания А' }]}
        selectedCompanyId="company-a"
        canSync
        canPay={false}
        canManage
        filters={{}}
        vehicles={[]}
        clients={[]}
        pagination={{ page: 1, pageSize: 24, total: 1, totalPages: 1 }}
        summary={{
          newCount: 1,
          unpaidCount: 1,
          unpaidAmountMinor: '25000',
          unassignedCount: 1,
          discountEndingSoonCount: 1,
          bailiffRiskCount: 1,
        }}
        fines={[
          {
            id: 'fine-a',
            companyId: 'company-a',
            decreeNumber: '18810150210001234567',
            offenseAt: '2026-08-16T09:30:00.000Z',
            currentAmountMinor: '25000',
            originalAmountMinor: '50000',
            status: 'UNPAID',
            description: null,
            address: null,
            comment: null,
            vehicleLabel: 'Kia Cee’d · А429АУ97',
            clientLabel: null,
            rentalLabel: null,
            photoAvailable: false,
            assigned: false,
            assignmentCandidates: [],
            discountExpiresAt: '2026-08-20T00:00:00.000Z',
            toBailiff: true,
          },
        ]}
      />,
    );

    expect(markup).toContain('Скидка заканчивается');
    expect(markup).toContain('Риск передачи приставам');
    expect(markup).toContain('Передача приставам');
    expect(markup).not.toContain('Тестовая оплата');
    expect(markup).not.toContain('Выбрать для оплаты');
  });
});
