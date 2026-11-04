import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FiAlertCircle,
  FiCreditCard,
  FiDroplet,
  FiFileText,
  FiTool,
  FiUsers,
} from 'react-icons/fi';
import { describe, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('@/modules/auth/actions', () => ({ logoutAction: vi.fn() }));

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
  it('keeps profile in the header and provides logout at the bottom', () => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user, systemHealthSummary: summary }),
    );
    expect(markup).not.toContain('href="/profile"');
    expect(markup).toContain('Выйти');
  });
  it('показывает ТО и мойку в единой навигации с доменными иконками', () => {
    expect(navigation.map(({ href }) => href)).toEqual([
      '/',
      '/map',
      '/vehicles',
      '/clients',
      '/leads',
      '/rentals',
      '/statistics',
      '/fines',
      '/deposits',
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
        { label: 'Залоги', href: '/deposits', icon: FiCreditCard, requiredCapability: 'RENTALS' },
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
    expect(permitted).toContain('href="/deposits"');
    expect(permitted).toContain('Залоги');
  });

  it('показывает штрафы только при server-derived fines capability', () => {
    const denied = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user: member, systemHealthSummary: summary }),
    );
    const permitted = renderToStaticMarkup(
      createElement(Sidebar, {
        expanded: true,
        user: { ...member, capabilities: ['CLIENTS', 'FINES'] },
        systemHealthSummary: summary,
      }),
    );
    expect(denied).not.toContain('href="/fines"');
    expect(permitted).toContain('href="/fines"');
    expect(permitted).toContain('Штрафы');
  });

  it('показывает отдельные синие овальные счётчики с полными числами рядом со штрафами, залогами и заявками', () => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, {
        expanded: true,
        user: { ...member, capabilities: ['CLIENTS', 'RENTALS', 'FINES'] },
        systemHealthSummary: summary,
        openFineCount: 64,
        openLeadCount: 128,
        openDepositCount: 7,
      }),
    );

    expect(markup).toContain('data-fines-count="64"');
    expect(markup).toContain('data-leads-count="128"');
    expect(markup).toContain('data-deposits-count="7"');
    expect(markup).toContain('rounded-full');
    expect(markup).toContain('bg-[#0067ff]');
    expect(markup).toContain('ml-1.5');
    expect(markup).toContain('min-w-8');
    expect(markup).toContain('>128</span>');
    expect(markup).not.toContain('99+');
    expect(markup).not.toContain('shadow');
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
    expect(markup.indexOf('href="/system"')).toBeLessThan(markup.indexOf('</nav>'));
    expect(markup).toContain('Состояние системы');
    expect(markup).toContain('Требуется внимание');
    expect(markup).toContain('1/4');
    expect(markup).toContain('1 из 4');
    expect(markup).not.toContain('postgresql');
    expect(markup).not.toContain('internal');
  });

  it('не дублирует аватар и данные профиля в боковом меню', () => {
    const markup = renderToStaticMarkup(
      createElement(Sidebar, { expanded: true, user, systemHealthSummary: summary }),
    );

    expect(markup).not.toContain('role="img"');
    expect(markup).not.toContain(user.email);
  });
});
