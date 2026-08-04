// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TeamList } from './TeamList';

afterEach(cleanup);

const team = [
  {
    id: 'member-1',
    name: 'Анна Воронцова',
    email: 'anna.vorontsova@sever-trans.demo',
    role: 'COMPANY_ADMIN' as const,
    isActive: false,
  },
  {
    id: 'member-2',
    name: 'Максим Орлов',
    email: 'maksim.orlov@sever-trans.demo',
    role: 'DISPATCHER' as const,
    isActive: false,
  },
  {
    id: 'member-3',
    name: 'Дмитрий Соколов',
    email: 'dmitry.sokolov@sever-trans.demo',
    role: 'DRIVER' as const,
    isActive: false,
  },
  {
    id: 'member-4',
    name: 'Елена Миронова',
    email: 'elena.mironova@sever-trans.demo',
    role: 'VIEWER' as const,
    isActive: false,
  },
];

describe('TeamList', () => {
  it('показывает участников с русскими ролями и статусами', () => {
    render(<TeamList team={team} />);

    expect(screen.getByText('Анна Воронцова')).toBeTruthy();
    expect(screen.getByText('Администратор компании')).toBeTruthy();
    expect(screen.getByText('Диспетчер')).toBeTruthy();
    expect(screen.getByText('Водитель')).toBeTruthy();
    expect(screen.getByText('Наблюдатель')).toBeTruthy();
    expect(screen.getAllByText('Неактивен')).toHaveLength(4);
  });

  it('показывает честное пустое состояние команды', () => {
    render(<TeamList team={[]} />);

    expect(screen.getByText('Пользователи пока не добавлены')).toBeTruthy();
  });
});
