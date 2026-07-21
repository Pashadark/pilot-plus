import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FiDroplet, FiTool } from 'react-icons/fi';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { Sidebar } from './Sidebar';
import { navigation } from './navigation';

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
  it('показывает ТО и мойку в единой навигации с доменными иконками', () => {
    expect(navigation.map(({ href }) => href)).toEqual(
      expect.arrayContaining(['/maintenance', '/wash']),
    );
    expect(navigation).toEqual(
      expect.arrayContaining([
        { label: 'Техническое обслуживание', href: '/maintenance', icon: FiTool },
        { label: 'Мойка', href: '/wash', icon: FiDroplet },
      ]),
    );
  });

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
