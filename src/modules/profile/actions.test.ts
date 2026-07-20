import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePathMock = vi.hoisted(() => vi.fn());
const prismaMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  transactionUserUpdateMany: vi.fn(),
  transactionThrottleDeleteMany: vi.fn(),
  transactionSessionUpdateMany: vi.fn(),
  transactionSessionDeleteMany: vi.fn(),
  transaction: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  getAuthenticatedSession: vi.fn(),
  prepareSessionRotation: vi.fn(),
  commitSessionRotationCookie: vi.fn(),
  isLoginLocked: vi.fn(),
  recordLoginFailure: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    user: { findUnique: prismaMocks.userFindUnique },
    $transaction: prismaMocks.transaction,
  },
}));
vi.mock('@/services/auth/password', () => ({
  verifyPassword: authMocks.verifyPassword,
  hashPassword: authMocks.hashPassword,
}));
vi.mock('@/services/auth/session', () => ({
  getAuthenticatedSession: authMocks.getAuthenticatedSession,
  prepareSessionRotation: authMocks.prepareSessionRotation,
  commitSessionRotationCookie: authMocks.commitSessionRotationCookie,
}));
vi.mock('@/modules/auth/throttle', () => ({
  isLoginLocked: authMocks.isLoginLocked,
  recordLoginFailure: authMocks.recordLoginFailure,
}));

import { changePasswordAction, updateProfileAction } from './actions';

const idle = { status: 'idle' as const };
const currentSessionExpiresAt = new Date('2026-07-27T12:00:00.000Z');
const userUpdatedAt = new Date('2026-07-20T12:00:00.000Z');
const session = {
  user: { id: 'u1', email: 'old@example.com', name: 'Старое имя', role: 'ADMIN' as const },
  currentSessionId: 'session-current',
  currentSessionTokenHash: 'old-token-hash',
  currentSessionExpiresAt,
};
const rotation = {
  token: 'new-bearer-token',
  tokenHash: 'new-token-hash',
  expiresAt: currentSessionExpiresAt,
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
    authMocks.isLoginLocked.mockResolvedValue(false);
    prismaMocks.userFindUnique.mockResolvedValue({
      email: session.user.email,
      passwordHash: 'old-hash',
      updatedAt: userUpdatedAt,
    });
    authMocks.verifyPassword.mockResolvedValue(true);
    authMocks.hashPassword.mockResolvedValue('new-hash');
    authMocks.prepareSessionRotation.mockReturnValue(rotation);
    authMocks.commitSessionRotationCookie.mockResolvedValue(undefined);
    prismaMocks.transactionUserUpdateMany.mockResolvedValue({ count: 1 });
    prismaMocks.transactionSessionUpdateMany.mockResolvedValue({ count: 1 });
    prismaMocks.transactionSessionDeleteMany.mockResolvedValue({ count: 2 });
    prismaMocks.transactionThrottleDeleteMany.mockResolvedValue({ count: 1 });
    prismaMocks.transaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          user: { updateMany: prismaMocks.transactionUserUpdateMany },
          loginThrottle: { deleteMany: prismaMocks.transactionThrottleDeleteMany },
          session: {
            updateMany: prismaMocks.transactionSessionUpdateMany,
            deleteMany: prismaMocks.transactionSessionDeleteMany,
          },
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
    ['основные данны', updateProfileAction, profileForm],
    ['пароль', changePasswordAction, passwordForm],
  ])(
    'не запускает scrypt при блокировке confirmation throttle: %s',
    async (_label, action, makeForm) => {
      authMocks.isLoginLocked.mockResolvedValue(true);

      const result = await action(idle, makeForm());

      expect(result).toEqual({
        status: 'error',
        message: 'Не удалось подтвердить текущий пароль.',
      });
      expect(authMocks.isLoginLocked).toHaveBeenCalledWith('old@example.com');
      expect(authMocks.verifyPassword).not.toHaveBeenCalled();
      expect(prismaMocks.transaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['основные данны', updateProfileAction, profileForm],
    ['пароль', changePasswordAction, passwordForm],
  ])(
    'учитывает неверное подтверждение в LoginThrottle без утечек: %s',
    async (_label, action, makeForm) => {
      authMocks.verifyPassword.mockResolvedValue(false);

      const result = await action(idle, makeForm());

      expect(result).toEqual({
        status: 'error',
        message: 'Не удалось подтвердить текущий пароль.',
      });
      expect(authMocks.recordLoginFailure).toHaveBeenCalledWith('old@example.com');
      expect(prismaMocks.transaction).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain('Текущий пароль 2026');
    },
  );

  it('безопасно сообщает о занятом email', async () => {
    prismaMocks.transaction.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['email'] } });

    await expect(updateProfileAction(idle, profileForm())).resolves.toEqual({
      status: 'error',
      message: 'Этот email уже используется',
    });
  });

  it('обновляет профиль только по проверенному hash/version и живой сессии', async () => {
    const result = await updateProfileAction(idle, profileForm());

    expect(prismaMocks.transactionSessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-current',
        userId: 'u1',
        tokenHash: 'old-token-hash',
        expiresAt: { gt: expect.any(Date) },
      },
      data: { expiresAt: currentSessionExpiresAt },
    });
    expect(prismaMocks.transactionUserUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'u1',
        passwordHash: 'old-hash',
        updatedAt: userUpdatedAt,
        isActive: true,
        role: 'ADMIN',
      },
      data: { name: 'Новое имя', email: 'new@example.com' },
    });
    expect(prismaMocks.transactionThrottleDeleteMany).toHaveBeenCalledWith({
      where: { email: { in: ['old@example.com', 'new@example.com'] } },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/profile');
    expect(result).toEqual({ status: 'success', message: 'Профиль сохранён.' });
  });

  it('отклоняет commit, если текущая сессия исчезла во время проверки', async () => {
    prismaMocks.transactionSessionUpdateMany.mockResolvedValue({ count: 0 });

    const result = await updateProfileAction(idle, profileForm());

    expect(prismaMocks.transactionUserUpdateMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'error', message: 'Сессия истекла. Войдите снова.' });
  });

  it('отклоняет stale passwordHash/version по affected row count', async () => {
    prismaMocks.transactionUserUpdateMany.mockResolvedValue({ count: 0 });

    const result = await updateProfileAction(idle, profileForm());

    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'error',
      message: 'Не удалось подтвердить текущий пароль.',
    });
  });

  it('не позволяет двум параллельным операциям со старым паролем обе зафиксироваться', async () => {
    prismaMocks.transactionUserUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.all([
      changePasswordAction(idle, passwordForm()),
      changePasswordAction(idle, passwordForm()),
    ]);

    expect(results.filter(({ status }) => status === 'success')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'error')).toHaveLength(1);
    expect(authMocks.commitSessionRotationCookie).toHaveBeenCalledOnce();
  });

  it('атомарно меняет пароль, ротирует bearer и удаляет остальные сессии', async () => {
    const result = await changePasswordAction(idle, passwordForm());

    expect(authMocks.prepareSessionRotation).toHaveBeenCalledWith(currentSessionExpiresAt);
    expect(prismaMocks.transactionSessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-current',
        userId: 'u1',
        tokenHash: 'old-token-hash',
        expiresAt: { gt: expect.any(Date) },
      },
      data: { tokenHash: 'new-token-hash', expiresAt: currentSessionExpiresAt },
    });
    expect(prismaMocks.transactionUserUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'u1',
        passwordHash: 'old-hash',
        updatedAt: userUpdatedAt,
        isActive: true,
        role: 'ADMIN',
      },
      data: { passwordHash: 'new-hash' },
    });
    expect(prismaMocks.transactionSessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', id: { not: 'session-current' } },
    });
    expect(prismaMocks.transactionThrottleDeleteMany).toHaveBeenCalledWith({
      where: { email: 'old@example.com' },
    });
    expect(authMocks.commitSessionRotationCookie).toHaveBeenCalledWith(rotation);
    expect(prismaMocks.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      authMocks.commitSessionRotationCookie.mock.invocationCallOrder[0] ?? 0,
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/profile');
    expect(result).toEqual({ status: 'success', message: 'Пароль изменён.' });
  });

  it('не выставляет новую cookie при откате транзакции', async () => {
    prismaMocks.transactionSessionDeleteMany.mockRejectedValue(new Error('session delete failed'));

    const result = await changePasswordAction(idle, passwordForm());

    expect(authMocks.commitSessionRotationCookie).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'error',
      message: 'Не удалось изменить пароль. Попробуйте снова.',
    });
  });

  it('не возвращает пароли и token hashes в состоянии ошибки', async () => {
    authMocks.verifyPassword.mockRejectedValue(new Error('Текущий пароль 2026 old-token-hash'));

    const result = await changePasswordAction(idle, passwordForm());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('Текущий пароль 2026');
    expect(serialized).not.toContain('Новый пароль 2026');
    expect(serialized).not.toContain('old-token-hash');
  });
});
