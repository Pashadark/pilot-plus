// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/shared/providers/ToastProvider';

import { ProfileWorkspace } from './ProfileWorkspace';
import type { ProfileViewModel } from './profile-model';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock('./avito-actions', () => ({ updateAvitoProfileControl: vi.fn() }));

const profile: ProfileViewModel = {
  user: {
    id: 'user-1',
    name: 'Павел Седов',
    avatarUrl: null,
    email: 'sedoffwork@mail.ru',
    role: 'SUPER_ADMIN',
    canAccessAdmin: true,
  },
  company: {
    name: 'СУПА ПРО',
    office: 'Москва',
    legalRole: 'Основатель и владелец',
    members: [
      {
        id: 'user-1',
        name: 'Павел Седов',
        role: 'Суперадминистратор',
        position: 'Основатель и владелец',
        status: 'Активен',
        avatarUrl: null,
        lastActivityAt: 'Сегодня, 08:00',
      },
      {
        id: 'user-2',
        name: 'Анна Операторова',
        role: 'Оператор',
        position: 'Оператор автопарка',
        status: 'Активен',
        avatarUrl: null,
        lastActivityAt: 'Вчера, 18:20',
      },
    ],
  },
  role: {
    label: 'Суперадминистратор',
    position: 'Основатель и владелец',
    permissions: [
      'Полный доступ',
      'Управление сотрудниками',
      'Финансы и отчёты',
      'Настройки системы',
    ],
  },
  account: {
    status: 'Аккаунт активен',
    registeredAt: '12.03.2021',
    lastLoginAt: 'Сегодня, 08:00',
    sessionExpiresAt: '08.09.2026, 08:00',
    activeSessions: 2,
    sessions: [
      {
        id: 'session-current',
        createdAt: '01.09.2026, 08:00',
        expiresAt: '08.09.2026, 08:00',
        current: true,
      },
      {
        id: 'session-other',
        createdAt: '31.08.2026, 19:10',
        expiresAt: '07.09.2026, 19:10',
        current: false,
      },
    ],
  },
  bannerUrl: '/profile/banner?v=1',
};

function renderProfile() {
  return render(
    <ToastProvider>
      <ProfileWorkspace profile={profile} />
    </ToastProvider>,
  );
}

describe('ProfileWorkspace', () => {
  afterEach(cleanup);
  it('constrains the profile grid and tab navigation to the mobile viewport', () => {
    renderProfile();
    expect(screen.getByRole('region', { name: 'Профиль сотрудника' }).className).toContain(
      'grid-cols-1',
    );
    const tabs = screen.getByRole('tablist', { name: 'Разделы профиля' });
    expect(tabs.parentElement?.className).toContain('min-w-0');
    expect(tabs.className).toContain('w-full');
    expect(screen.getByText(profile.user.email).className).not.toContain('truncate');
  });
  it('keeps the bot control inside the Automation tab only', () => {
    render(
      <ToastProvider>
        <ProfileWorkspace
          profile={profile}
          avito={{ enabled: false, enabledAt: null, updatedAt: null }}
        />
      </ToastProvider>,
    );
    expect(screen.queryByRole('switch', { name: 'Автоответчик Авито' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Автоматизация' }));
    expect(screen.getByRole('switch', { name: 'Автоответчик Авито' })).toBeTruthy();
    expect(screen.getByText('Что делает бот')).toBeTruthy();
  });

  it('shows company, account status and role in the profile overview', () => {
    renderProfile();
    const identityDock = screen.getByTestId('profile-identity-dock');
    expect(screen.getByRole('heading', { name: 'Павел Седов' })).toBeTruthy();
    expect(identityDock.textContent).toContain('СУПА ПРО');
    expect(identityDock.textContent).toContain('Аккаунт активен');
    expect(identityDock.textContent).toContain('Суперадминистратор');
    expect(identityDock.textContent).not.toContain('Управление автопарком');
    expect(identityDock.className).toContain('lg:flex-row');
    expect(identityDock.className).not.toContain('sm:flex-row');
    expect(screen.getByRole('heading', { name: 'Павел Седов' }).className).not.toContain(
      'truncate',
    );
  });

  it('opens the avatar file picker from the avatar pencil', () => {
    renderProfile();
    const input = screen.getByLabelText('Выбрать новую аватарку') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Изменить аватарку' }));
    expect(click).toHaveBeenCalledOnce();
  });

  it('opens password settings on the security tab', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('tab', { name: 'Безопасность' }));
    expect(screen.getByLabelText(/^Новый пароль/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Завершить остальные сессии' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /завершить сессию от 31\.08\.2026/i })).toBeTruthy();
  });

  it('shows the full company team and removes the redundant banner badge', () => {
    renderProfile();
    expect(screen.queryByText('Управление автопарком')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Компания' }));
    expect(screen.getByText('Анна Операторова')).toBeTruthy();
    expect(screen.getByText('Оператор автопарка')).toBeTruthy();
  });

  it('opens the banner image picker', () => {
    renderProfile();
    const input = screen.getByLabelText('Выбрать фон профиля') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Изменить фон профиля' }));
    expect(click).toHaveBeenCalledOnce();
  });
});
