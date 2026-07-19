import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);
const userFindUnique = vi.hoisted(() => vi.fn());
const authMocks = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  isLoginLocked: vi.fn(),
  recordLoginFailure: vi.fn(),
  clearLoginFailures: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/database/prisma/client', () => ({ prisma: { user: { findUnique: userFindUnique } } }));
vi.mock('@/services/auth/password', () => ({ verifyPassword: authMocks.verifyPassword }));
vi.mock('@/services/auth/session', () => ({
  createSession: authMocks.createSession,
  deleteSession: authMocks.deleteSession,
}));
vi.mock('./throttle', () => ({
  isLoginLocked: authMocks.isLoginLocked,
  recordLoginFailure: authMocks.recordLoginFailure,
  clearLoginFailures: authMocks.clearLoginFailures,
}));

import { loginAction, logoutAction } from './actions';

const idle = { status: 'idle' as const };
function form(email: string, password: string) {
  const data = new FormData();
  data.set('email', email);
  data.set('password', password);
  return data;
}

describe('действия авторизации', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.isLoginLocked.mockResolvedValue(false);
  });

  it('не обращается к БД при невалидном вводе', async () => {
    const result = await loginAction(idle, form('не-email', ''));
    expect(result.status).toBe('error');
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['неизвестный email', null, false, false],
    [
      'неверный пароль',
      { id: 'u1', isActive: true, role: 'ADMIN', passwordHash: 'hash' },
      false,
      false,
    ],
    [
      'неактивный пользователь',
      { id: 'u1', isActive: false, role: 'ADMIN', passwordHash: 'hash' },
      true,
      false,
    ],
    ['блокировка', null, false, true],
  ])('возвращает общую ошибку: %s', async (_label, user, passwordMatches, locked) => {
    authMocks.isLoginLocked.mockResolvedValue(locked);
    userFindUnique.mockResolvedValue(user);
    authMocks.verifyPassword.mockResolvedValue(passwordMatches);

    const result = await loginAction(idle, form('admin@example.com', 'Надёжный пароль 2026'));
    expect(result).toEqual({
      status: 'error',
      message: 'Не удалось войти. Проверьте данные и попробуйте позже.',
    });
  });

  it('создаёт сессию и перенаправляет успешного администратора', async () => {
    userFindUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      role: 'ADMIN',
      passwordHash: 'hash',
    });
    authMocks.verifyPassword.mockResolvedValue(true);

    await expect(
      loginAction(idle, form('admin@example.com', 'Надёжный пароль 2026')),
    ).rejects.toThrow('REDIRECT:/?welcome=1');
    expect(authMocks.clearLoginFailures).toHaveBeenCalledWith('admin@example.com');
    expect(authMocks.createSession).toHaveBeenCalledWith('u1');
    expect(redirectMock).toHaveBeenCalledWith('/?welcome=1');
  });

  it('отзывает сессию перед выходом', async () => {
    await expect(logoutAction()).rejects.toThrow('REDIRECT:/login?loggedOut=1');
    expect(authMocks.deleteSession).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith('/login?loggedOut=1');
  });
});
