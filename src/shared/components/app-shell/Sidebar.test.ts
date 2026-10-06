import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FiAlertCircle, FiDroplet, FiFileText, FiTool, FiUsers } from 'react-icons/fi';
import { describe, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));

import { Sidebar } from './Sidebar';
import { navigation } from './navigation';

const user = {
  id: 'admin-1',
  name: 'Администратор',
  email: 'admin@pilot.local',
  role: 'SUPER_ADMIN' as const,
  canAccessAdmin: true,
};
const summary = {
  state: 'degraded' as const,
  count: 1,
  total: 4,
  checkedAt: '2026-07-20T12:00:00.000Z',
};
const member = { ...user, role: 'MEMBER' as const, canAccessAdmin: false };

describe('Sidebar health summary', () => {
  it('показывает ТО и мойку в единой навигации с доменными иконками', () => {
    expect(navigation.map(({ href }) => href)).toEqual([
      '/',
      '/map',
      '/vehicles',
      '/clients',
      '/leads',
      '/rentals',
      '/fines',
      '/maintenance',
      '/wash',
      '/devices',
      '/events',
      '/admin',
      '/system',
      '/ui-kit',
    ]);
    expect(navigation).toEqual(
      expect.arrayContaining([
        { label: 'Техническое обслуживание', href: '/maintenance', icon: FiTool },
        { label: 'Мойка', href: '/wash', icon: FiDroplet },
        { label: 'Клиенты', href: '/clients', icon: FiUsers, requiredCapability: 'CLIENTS' },
        { label: 'Аренда', href: '/rentals', icon: FiFileText, requiredCapability: 'RENTALS' },
        { label: 'Штрафы', href: '/fines', icon: FiAlertCircle, requiredCapability: 'FINES' },
      ]),
    );
  });

  it('показывает разрешённую административную ссылку и отмечает её текущей', () => {
    route.pathname = '/admin';

    const markup = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user, systemHealthSummary: summary }),
    );

    expect(markup).toContain('href="/admin"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Администрирование');
  });

  it('группирует навигацию и отмечает текущий раздел спокойным индикатором', () => {
    route.pathname = '/vehicles';

    const markup = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user, systemHealthSummary: summary }),
    );

    expect(markup).toContain('Работа');
    expect(markup).toContain('Операции');
    expect(markup).toContain('Система');
    expect(markup).not.toContain('data-active-indicator="true"');
  });

  it('скрывает административную ссылку без административного разрешения', () => {
    route.pathname = '/';

    const markup = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user: member, systemHealthSummary: summary }),
    );

    expect(markup).not.toContain('href="/admin"');
    expect(markup).not.toContain('Администрирование');
  });

  it('скрывает клиентов без безопасной capability, полученной layout на сервере', () => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user: member, systemHealthSummary: summary }),
    );

    expect(markup).not.toContain('href="/clients"');
    expect(markup).not.toContain('Клиенты');
  });

  it('показывает клиентов, когда layout передал capability', () => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, {
        expanded: true,
        user: { ...member, capabilities: ['CLIENTS'] },
        systemHealthSummary: summary,
      }),
    );

    expect(markup).toContain('href="/clients"');
    expect(markup).toContain('Клиенты');
  });

  it('показывает аренду только при server-derived rental capability', () => {
    const denied = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user: member, systemHealthSummary: summary }),
    );
    const permitted = renderToStaticMarkup(
      createElement(Sidebar, {
        expanded: true,
        user: { ...member, capabilities: ['RENTALS'] },
        systemHealthSummary: summary,
      }),
    );

    expect(denied).not.toContain('href="/rentals"');
    expect(permitted).toContain('href="/rentals"');
    expect(permitted).toContain('Аренда');
  });

  it('показывает штрафы только при server-derived fines capability', () => {
    const denied = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user: member, systemHealthSummary: summary }),
    );
    const permitted = renderToStaticMarkup(
      createElement(Sidebar, {
        expanded: true,
        user: { ...member, capabilities: ['FINES'] },
        systemHealthSummary: summary,
      }),
    );
    expect(denied).not.toContain('href="/fines"');
    expect(permitted).toContain('href="/fines"');
    expect(permitted).toContain('Штрафы');
  });

  it('даёт раскрытым подписям доступную ширину и перенос строк', () => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user, systemHealthSummary: summary }),
    );

    expect(markup).toContain('data-navigation-label="true"');
    expect(markup).toContain('min-w-0 flex-1');
    expect(markup).toContain('leading-snug whitespace-normal');
    expect(markup).not.toContain('w-40 opacity-100');
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
    expect(markup).toContain('1/4');
    expect(markup).toContain('1 из 4');
    expect(markup).not.toContain('postgresql');
    expect(markup).not.toContain('internal');
  });

  it('показывает общий Avatar с фактическим именем пользователя', () => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user, systemHealthSummary: summary }),
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Администратор"');
    expect(markup).toContain('size-9');
  });
});
