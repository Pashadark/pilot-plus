import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FinePaymentPanel } from './FinePaymentPanel';

describe('FinePaymentPanel', () => {
  it('labels the sandbox payment and keeps the selected fine totals visible', () => {
    const markup = renderToStaticMarkup(
      <FinePaymentPanel
        companyId="company-a"
        selectedFines={[
          { id: 'fine-a', decreeNumber: '18810150210001234567', currentAmountMinor: '25000' },
        ]}
      />,
    );

    expect(markup).toContain('Тестовая оплата — деньги не списываются');
    expect(markup).toContain('Проверить сумму');
    expect(markup).toContain('Создать тестовый счёт');
    expect(markup).toContain('18810150210001234567');
    expect(markup).toContain('250\u00a0₽');
  });
});
