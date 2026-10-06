import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ReadinessCard } from './ReadinessCard';

describe('ReadinessCard', () => {
  it('shows progress, blockers, warnings, and correction links', () => {
    const markup = renderToStaticMarkup(
      <ReadinessCard
        title="Готовность к аренде"
        completed={3}
        total={5}
        result={{
          ready: false,
          blockers: [
            {
              code: 'DOC',
              message: 'Загрузите паспорт.',
              href: '?tab=documents',
              severity: 'BLOCKER',
            },
          ],
          warnings: [
            { code: 'WARN', message: 'Проверьте телефон.', href: '#contacts', severity: 'WARNING' },
          ],
        }}
      />,
    );

    expect(markup).toContain('3 из 5');
    expect(markup).toContain('href="?tab=documents"');
    expect(markup).toContain('Загрузите паспорт.');
    expect(markup).toContain('Проверьте телефон.');
  });
});
