import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePathMock = vi.hoisted(() => vi.fn());
const prismaMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  transactionUserUpdate: vi.fn(),
  transactionThrottleDeleteMany: vi.fn(),
  transactionSessionDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  getAuthenticatedSession: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    user: {
      findUnique: prismaMocks.userFindUnique,
      update: prismaMocks.userUpdate,
    },
    $transaction: prismaMocks.transaction,
  },
}));
vi.mock('@/services/auth/password', () => ({
  verifyPassword: authMocks.verifyPassword,
  hashPassword: authMocks.hashPassword,
}));
vi.mock('@/services/auth/session', () => ({
  getAuthenticatedSession: authMocks.getAuthenticatedSession,
}));

import { changePasswordAction, updateProfileAction } from './actions';

const idle = { status: 'idle' as const };
const session = {
  user: { id: 'u1', email: 'old@example.com', name: 'Старое имя', role: 'ADMIN' as const },
  currentSessionId: 'session-current',
};

function profileForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set('name', overrides.name ?? 'Новое имя');
  data.set('email', overrides.email ?? 'new@example.com');
  data.set('currentPassword', overrides.currentPassword ?? 'Текущий пароль 2026');
  return data;
}

function passwordForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set('currentPassword', overrides.currentPassword ?? 'Текущий пароль 2026');
  data.set('newPassword', overrides.newPassword ?? 'Новый пароль 2026');
  data.set('confirmPassword', overrides.confirmPassword ?? 'Новый пароль 2026');
  return data;
}

describe('действия профиля', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getAuthenticatedSession.mockResolvedValue(session);
    prismaMocks.userFindUnique.mockResolvedValue({
      email: session.user.email,
      passwordHash: 'old-hash',
    });
    authMocks.verifyPassword.mockResolvedValue(true);
    authMocks.hashPassword.mockResolvedValue('new-hash');
    prismaMocks.transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          user: { update: prismaMocks.transactionUserUpdate },
          loginThrottle: { deleteMany: prismaMocks.transactionThrottleDeleteMany },
          session: { deleteMany: prismaMocks.transactionSessionDeleteMany },
        }),
    );
  });

  it('требует действующую серверную сессию для обеих форм', async () => {
    authMocks.getAuthenticatedSession.mockResolvedValue(null);

    await expect(updateProfileAction(idle, profileForm())).resolves.toEqual({
      status: 'error',
      message: 'Сессия истекла. Войдите снова.',
    });
    await expect(changePasswordAction(idle, passwordForm())).resolves.toEqual({
      status: 'error',
      message: 'Сессия истекла. Войдите снова.',
    });
    expect(prismaMocks.userFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['основные данные', updateProfileAction, profileForm],
    ['пароль', changePasswordAction, passwordForm],
  ])('отклоняет неверный текущий пароль до изменения: %s', async (_label, action, makeForm) => {
    authMocks.verifyPassword.mockResolvedValue(false);

    const result = await action(idle, makeForm());

    expect(result).toEqual({
      status: 'error',
      message: 'Не удалось подтвердить текущий пароль.',
    });
    expect(prismaMocks.transaction).not.toHaveBeenCalled();
    expect(prismaMocks.userUpdate).not.toHaveBeenCalled();
    expect(prismaMocks.transactionSessionDeleteMany).not.toHaveBeenCalled();
  });

  it('безопасно сообщает о занятом email', async () => {
    prismaMocks.transaction.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });

    const result = await updateProfileAction(idle, profileForm());

    expect(result).toEqual({ status: 'error', message: 'Этот email уже используется' });
  });

  it('обновляет профиль и очищает throttle старого и нового email в транзакции', async () => {
    const result = await updateProfileAction(idle, profileForm());

    expect(prismaMocks.transactionUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: 'Новое имя', email: 'new@example.com' },
    });
    expect(prismaMocks.transactionThrottleDeleteMany).toHaveBeenCalledWith({
      where: { email: { in: ['old@example.com', 'new@example.com'] } },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/profile');
    expect(result).toEqual({ status: 'success', message: 'Профиль сохранён.' });
  });

  it('меняет пароль и удаляет все сессии, кроме текущей', async () => {
    const result = await changePasswordAction(idle, passwordForm());

    expect(authMocks.hashPassword).toHaveBeenCalledWith('Новый пароль 2026');
    expect(prismaMocks.transactionUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'new-hash' },
    });
    expect(prismaMocks.transactionSessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', id: { not: 'session-current' } },
    });
    expect(prismaMocks.userUpdate).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith('/profile');
    expect(result).toEqual({ status: 'success', message: 'Пароль изменён.' });
  });

  it('не подтверждает смену пароля при отказе удаления других сессий в транзакции', async () => {
    prismaMocks.transactionSessionDeleteMany.mockRejectedValue(new Error('session delete failed'));

    const result = await changePasswordAction(idle, passwordForm());

    expect(prismaMocks.transaction).toHaveBeenCalledOnce();
    expect(prismaMocks.transactionUserUpdate).toHaveBeenCalledOnce();
    expect(prismaMocks.transactionSessionDeleteMany).toHaveBeenCalledOnce();
    expect(prismaMocks.userUpdate).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'error',
      message: 'Не удалось изменить пароль. Попробуйте снова.',
    });
  });

  it('не возвращает пароли в состоянии ошибки', async () => {
    authMocks.verifyPassword.mockRejectedValue(new Error('Текущий пароль 2026'));

    const result = await changePasswordAction(idle, passwordForm());

    expect(JSON.stringify(result)).not.toContain('Текущий пароль 2026');
    expect(JSON.stringify(result)).not.toContain('Новый пароль 2026');
  });
});
