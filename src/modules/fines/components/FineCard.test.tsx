import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FineCard } from './FineCard';

const fine = {
  id: 'f1',
  decreeNumber: '18810550260831038048',
  offenseAt: '2026-08-27T10:29:00Z',
  decreeAt: '2026-08-28T00:00:00Z',
  currentAmountMinor: '56250',
  originalAmountMinor: '75000',
  discountExpiresAt: '2026-09-30T20:59:59Z',
  status: 'UNPAID' as const,
  description: 'Неправильная парковка',
  address: 'Москва',
  vehicleLabel: 'Mercedes-Benz E 220 · М283АМ997',
  clientLabel: 'Иван Петров',
  photoAvailable: false,
};
const props = {
  fine,
  referenceTime: '2026-09-27T00:00:00Z',
  canManage: false,
  canPay: true,
  selected: false,
  onToggle: () => {},
  onPay: () => {},
  onCopy: () => {},
};
describe('FineCard approved 02B', () => {
  it('matches the approved discount line and hides unavailable downloads', () => {
    const html = renderToStaticMarkup(<FineCard {...props} />);
    expect(html).toContain('Скидка до');
    expect(html).not.toMatch(/Скидка(?: ·)? 3 дн/);
    expect(html).not.toContain('Файл постановления недоступен');
    expect(html).toContain('data-testid="fine-offense-datetime"');
  });
  it('shows all primary data without a details disclosure or dot separators', () => {
    const html = renderToStaticMarkup(<FineCard {...props} />);
    for (const label of [
      'Водитель',
      'Дата постановления',
      '28.08.2026',
      '27.08.2026',
      '13:29',
      fine.decreeNumber,
      fine.address,
      'М283АМ997',
      'Оплатить штраф',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('Подробнее');
    expect(html).not.toContain(' · ');
    expect(html).toContain('fine-status-badge');
    expect(html).not.toContain('Подтверждено менеджером');
  });
  it('only shows the green confirmation with explicit evidence', () => {
    const html = renderToStaticMarkup(
      <FineCard {...props} fine={{ ...fine, assignmentConfirmedAt: '2026-09-27T10:00:00Z' }} />,
    );
    expect(html).toContain('Подтверждено менеджером');
  });
  it('does not offer payment for paid fines', () => {
    const html = renderToStaticMarkup(<FineCard {...props} fine={{ ...fine, status: 'PAID' }} />);
    expect(html).toContain('Оплачен');
    expect(html).not.toContain('Оплатить штраф');
    expect(html).toContain('color-success-soft');
  });
  it('shows an archived fine as neutral and does not offer payment', () => {
    const html = renderToStaticMarkup(
      <FineCard
        {...props}
        fine={{ ...fine, status: 'ARCHIVED', archivedAt: '2026-11-07T09:00:00.000Z' }}
      />,
    );
    expect(html).toContain('Архив');
    expect(html).toContain('В архиве с 07.11.2026');
    expect(html).not.toContain('Оплатить штраф');
    expect(html).toContain('color-elevated');
  });
});
