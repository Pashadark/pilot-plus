import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FinesPage } from './FinesPage';

describe('FinesPage', () => {
  it('shows road debt in the same grid without fine payment or decree controls', () => {
    const markup = renderToStaticMarkup(
      <FinesPage
        companies={[{ id: 'c1', name: 'C' }]}
        selectedCompanyId="c1"
        canSync={false}
        canPay
        summary={{ newCount: 0, unpaidCount: 1, unpaidAmountMinor: '10000', unassignedCount: 0 }}
        fines={[
          {
            id: 'toll:c1:1',
            companyId: 'c1',
            kind: 'TOLL',
            roadLabel: 'МСД',
            rentalId: 'r1',
            rentalLabel: '59',
            decreeNumber: '',
            offenseAt: '2026-09-22T09:00:00Z',
            currentAmountMinor: '10000',
            originalAmountMinor: '10000',
            status: 'UNPAID',
            description: 'Проезд',
            address: null,
            vehicleLabel: 'Polo',
            clientLabel: 'Иванов Иван',
            photoAvailable: false,
          },
        ]}
      />,
    );
    expect(markup).toContain('МСД');
    expect(markup).toContain('Платная дорога');
    expect(markup).toContain('Иванов Иван');
    expect(markup).toContain('href="/rentals/r1"');
    expect(markup).toContain('Проезд');
    expect(markup).not.toContain('Постановление');
    expect(markup).not.toContain('>Оплатить<');
  });
  it('explains that a browser return still awaits provider verification', () => {
    const markup = renderToStaticMarkup(
      <FinesPage
        summary={{ newCount: 0, unpaidCount: 0, unpaidAmountMinor: '0', unassignedCount: 0 }}
        fines={[]}
        companies={[]}
        canSync={false}
        paymentOutcome="returned"
      />,
    );
    expect(markup).toContain('Возврат из тестовой платёжной страницы получен');
    expect(markup).toContain('Оплата не подтверждена');
    expect(markup).toContain('штраф остаётся неоплаченным');
  });
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
    expect(markup).toContain('Kia Cee’d');
    expect(markup).toContain('А429АУ97');
    expect(markup).not.toContain('Kia Cee’d · А429АУ97');
    expect(markup).toMatch(/250\s₽/u);
    expect(markup).toContain('Не оплачен');
    expect(markup).toContain('Посмотреть фото');
    expect(markup).toContain('href="/fines/fine-a/photo"');
    expect(markup).toContain('Скачать фото постановления');
    expect(markup).toContain('№ 18810150210001234567');
    expect(markup).not.toContain('№ …01234567');
    expect(markup).toContain('text-sm leading-5 font-semibold');
    expect(markup).toContain('Скопировать номер постановления');
    expect(markup).toContain('Место нарушения');
    expect(markup).toContain('data-testid="fine-offense-address"');
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

  it('groups secondary search conditions under an active filter disclosure', () => {
    const markup = renderToStaticMarkup(
      <FinesPage
        companies={[{ id: 'company-a', name: 'Компания А' }]}
        selectedCompanyId="company-a"
        canSync={false}
        filters={{ vehicleId: 'vehicle-a', offenseFrom: '2026-09-01' }}
        vehicles={[{ id: 'vehicle-a', label: 'Kia K5' }]}
        clients={[]}
        summary={{ newCount: 0, unpaidCount: 0, unpaidAmountMinor: '0', unassignedCount: 0 }}
        fines={[]}
      />,
    );

    expect(markup).toContain('data-testid="fine-advanced-filters"');
    expect(markup).toContain('Все фильтры · 2');
    expect(markup).toContain('open=""');
  });
});
