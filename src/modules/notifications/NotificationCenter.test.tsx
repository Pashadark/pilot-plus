// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { NotificationCenter } from './NotificationCenter';
import type { PilotNotification } from './types';

const notifications: readonly PilotNotification[] = [
  {
    id: 'notification-1',
    title: 'Автомобиль вернулся в парк',
    description: 'Pilot 101 завершил поездку.',
    createdAt: 'Сегодня, 10:15',
    tone: 'success',
    href: '/vehicles',
  },
  {
    id: 'notification-2',
    title: 'Приближается техническое обслуживание',
    description: 'До планового ТО осталось 300 км.',
    createdAt: 'Сегодня, 09:40',
    tone: 'warning',
    href: '/maintenance',
  },
  {
    id: 'notification-3',
    title: 'Устройство потеряло связь',
    description: 'Pilot Connect не отвечает 15 минут.',
    createdAt: 'Вчера, 18:20',
    tone: 'danger',
    href: '/devices',
  },
];

afterEach(cleanup);

describe('центр уведомлений', () => {
  it('открывает список и отмечает все уведомления прочитанными', async () => {
    const user = userEvent.setup();
    render(<NotificationCenter notifications={notifications} />);

    expect(screen.getByText('3')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Уведомления: 3 непрочитанных' }));
    expect(screen.getByRole('dialog', { name: 'Уведомления' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Отметить всё прочитанным' }));
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
    await user.click(screen.getByRole('button', { name: 'Внешняя область' }));
    expect(screen.queryByRole('dialog', { name: 'Уведомления' })).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    const notificationLink = screen.getByRole('link', { name: /Автомобиль вернулся в парк/ });
    notificationLink.addEventListener('click', (event) => event.preventDefault());
    await user.click(notificationLink);
    expect(screen.queryByRole('dialog', { name: 'Уведомления' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('показывает русское пустое состояние', async () => {
    const user = userEvent.setup();
    render(<NotificationCenter notifications={[]} />);

    await user.click(screen.getByRole('button', { name: 'Уведомления: новых нет' }));
    expect(screen.getByText('Новых уведомлений нет.')).toBeTruthy();
  });
});
