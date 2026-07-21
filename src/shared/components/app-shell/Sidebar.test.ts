import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { Sidebar } from './Sidebar';

const user = {
  id: 'admin-1',
  name: 'Администратор',
  email: 'admin@pilot.local',
  role: 'ADMIN' as const,
};
const summary = {
  state: 'degraded' as const,
  count: 1,
  checkedAt: '2026-07-20T12:00:00.000Z',
};

describe('Sidebar health summary', () => {
  it.each([
    ['desktop', true],
    ['mobile', undefined],
  ])('показывает компактную русскую сводку и ссылку в %s footer', (_surface, expanded) => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, { expanded, user, systemHealthSummary: summary }),
    );

    expect(markup).toContain('href="/system"');
    expect(markup).toContain('Состояние системы');
    expect(markup).toContain('Требуется внимание');
    expect(markup).toContain('1/3');
    expect(markup).not.toContain('postgresql');
    expect(markup).not.toContain('internal');
  });
});
