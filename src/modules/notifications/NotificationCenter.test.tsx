// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actionMocks = vi.hoisted(() => ({
  markNotificationReadAction: vi.fn().mockResolvedValue({ status: 'success' }),
  markAllNotificationsReadAction: vi.fn().mockResolvedValue({ status: 'success' }),
  loadNotificationPageAction: vi.fn(),
  markEntireInboxReadAction: vi.fn().mockResolvedValue({ status: 'success' }),
}));

vi.mock('@/modules/notifications/server/actions', () => actionMocks);
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import { NotificationCenter } from './NotificationCenter';
import type { PilotNotification } from './types';

const notifications: readonly PilotNotification[] = [
  {
    id: 'notification-1',
    category: 'FLEET',
    title: 'Автомобиль вернулся в парк',
    description: 'Pilot 101 завершил поездку.',
    createdAt: 'Сегодня, 10:15',
    occurredAt: '2026-09-14T07:15:00.000Z',
    tone: 'success',
    href: '/vehicles',
  },
  {
    id: 'notification-2',
    category: 'FLEET',
    title: 'Приближается техническое обслуживание',
    description: 'До планового ТО осталось 300 км.',
    createdAt: 'Сегодня, 09:40',
    occurredAt: '2026-09-14T06:40:00.000Z',
    tone: 'warning',
    href: '/maintenance',
  },
  {
    id: 'notification-3',
    category: 'SYSTEM',
    title: 'Устройство потеряло связь',
    description: 'Pilot Connect не отвечает 15 минут.',
    createdAt: 'Вчера, 18:20',
    occurredAt: '2026-09-13T15:20:00.000Z',
    tone: 'danger',
    href: '/devices',
  },
];

afterEach(cleanup);
it('shows full count and loads another server page', async () => {
  const user = userEvent.setup();
  actionMocks.loadNotificationPageAction.mockResolvedValue({
    items: [
      {
        ...notifications[0],
        id: 'older',
        title: 'Старое уведомление',
        occurredAt: '2020-01-01T00:00:00.000Z',
      },
    ],
    nextCursor: null,
  });
  render(
    <NotificationCenter
      notifications={notifications}
      notificationMeta={{
        unreadCount: 145,
        nextCursor: { before: '2026-09-13T15:20:00.000Z', beforeKey: 'notification-3' },
      }}
    />,
  );
  expect(screen.getByTestId('notification-count').textContent).toBe('145');
  await user.click(screen.getByRole('button', { name: 'Уведомления: 145 непрочитанных' }));
  await user.click(screen.getByRole('button', { name: 'Показать ещё' }));
  expect(await screen.findByText('Старое уведомление')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Прочитать все' }));
  expect(actionMocks.markEntireInboxReadAction).toHaveBeenCalled();
});
beforeEach(() => vi.clearAllMocks());
it('respects read receipts received on a server refresh', () => {
  const view = render(<NotificationCenter notifications={notifications} />);
  expect(screen.getByTestId('notification-count').textContent).toBe('3');
  view.rerender(
    <NotificationCenter notifications={notifications.map((item) => ({ ...item, isRead: true }))} />,
  );
  expect(screen.queryByTestId('notification-count')).toBeNull();
});

describe('центр уведомлений', () => {
  it('открывает список и отмечает все уведомления прочитанными', async () => {
    const user = userEvent.setup();
    render(<NotificationCenter notifications={notifications} />);

    expect(screen.getByText('3')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Уведомления: 3 непрочитанных' }));
    expect(screen.getByRole('dialog', { name: 'Уведомления' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Прочитать все' }));
    expect(screen.queryByTestId('notification-count')).toBeNull();
    expect(screen.getByRole('button', { name: 'Уведомления: новых нет' })).toBeTruthy();
  });

  it('закрывается по Escape, клику вне панели и переходу по ссылке', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <NotificationCenter notifications={notifications} />
        <button type="button">Внешняя область</button>
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'Уведомления: 3 непрочитанных' });

    await user.click(trigger);
    expect(
      screen.getByRole('dialog', { name: 'Уведомления' }).contains(document.activeElement),
    ).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Уведомления' })).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    const outsideButton = screen.getByRole('button', { name: 'Внешняя область' });
    await user.click(outsideButton);
    expect(screen.queryByRole('dialog', { name: 'Уведомления' })).toBeNull();
    expect(document.activeElement).toBe(outsideButton);

    await user.click(trigger);
    const notificationLink = screen.getByRole('link', { name: /Автомобиль вернулся в парк/ });
    notificationLink.addEventListener('click', (event) => event.preventDefault());
    await user.click(notificationLink);
    expect(screen.queryByRole('dialog', { name: 'Уведомления' })).toBeNull();
  });

  it('показывает русское пустое состояние', async () => {
    const user = userEvent.setup();
    render(<NotificationCenter notifications={[]} />);

    await user.click(screen.getByRole('button', { name: 'Уведомления: новых нет' }));
    expect(screen.getByText('Новых уведомлений нет.')).toBeTruthy();
  });

  it('фильтрует единый поток по типу события и показывает автора', async () => {
    const user = userEvent.setup();
    render(
      <NotificationCenter
        notifications={[
          ...notifications,
          {
            id: 'audit:fine-1',
            category: 'FINE',
            title: 'Новый штраф',
            description: 'Штраф · Менеджер · СУПА ПРО',
            createdAt: 'Сегодня, 11:00',
            occurredAt: '2026-09-14T08:00:00.000Z',
            tone: 'warning',
            href: '/fines',
            actorLabel: 'Менеджер',
            companyLabel: 'СУПА ПРО',
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Уведомления:/ }));
    await user.click(screen.getByRole('button', { name: 'Штрафы' }));
    expect(screen.getByText('Новый штраф')).toBeTruthy();
    expect(screen.getByText('Менеджер · СУПА ПРО')).toBeTruthy();
    expect(screen.queryByText('Автомобиль вернулся в парк')).toBeNull();
  });

  it('сворачивает повторные события и отмечает всю группу прочитанной', async () => {
    const user = userEvent.setup();
    const repeated = Array.from({ length: 6 }, (_, index) => ({
      ...notifications[0],
      id: `repeated-${index + 1}`,
      occurredAt: `2026-09-14T07:1${index}:00.000Z`,
      createdAt: `Сегодня, 10:1${index}`,
    }));

    render(<NotificationCenter notifications={repeated} />);
    await user.click(screen.getByRole('button', { name: /Уведомления:/ }));

    expect(screen.getAllByText('Автомобиль вернулся в парк')).toHaveLength(1);
    expect(screen.getByText('6 событий')).toBeTruthy();

    const groupLink = screen.getByRole('link', { name: /Автомобиль вернулся в парк/ });
    groupLink.addEventListener('click', (event) => event.preventDefault());
    await user.click(groupLink);

    expect(actionMocks.markNotificationReadAction).toHaveBeenCalledTimes(6);
  });

  it('показывает сначала десять групп и позволяет раскрыть остальные', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...notifications[0],
      id: `event-${index}`,
      title: `Событие ${index + 1}`,
      href: `/vehicles/${index}`,
      occurredAt: `2026-09-14T${String(index).padStart(2, '0')}:00:00.000Z`,
    }));

    render(<NotificationCenter notifications={many} />);
    await user.click(screen.getByRole('button', { name: /Уведомления:/ }));

    expect(screen.getAllByRole('link')).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Показать ещё' }));
    expect(screen.getAllByRole('link')).toHaveLength(12);
  });
});
