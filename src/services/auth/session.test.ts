import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hashSessionToken } from './session-token';

const cookieMock = vi.hoisted(() => ({
  value: undefined as string | undefined,
  set: vi.fn(),
  delete: vi.fn(),
}));
const sessionRepository = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => (cookieMock.value ? { value: cookieMock.value } : undefined)),
    set: cookieMock.set,
    delete: cookieMock.delete,
  })),
}));
vi.mock('@/database/prisma/client', () => ({ prisma: { session: sessionRepository } }));

import {
  commitSessionRotationCookie,
  createSession,
  deleteOtherSessions,
  deleteSession,
  getAuthenticatedSession,
  prepareSessionRotation,
  readSession,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from './session';

describe('серверная сессия', () => {
  beforeEach(() => {
    cookieMock.value = undefined;
    vi.clearAllMocks();
  });

  it('хранит в БД только хеш и выставляет защищённую cookie', async () => {
    await createSession('user-1');

    const data = sessionRepository.create.mock.calls[0]?.[0].data;
    expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data).not.toHaveProperty('token');
    expect(cookieMock.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        expires: expect.any(Date),
      }),
    );
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + SESSION_TTL_MS - 1000);
  });

  it('возвращает только безопасного активного администратора', async () => {
    cookieMock.value = 'session-token';
    sessionRepository.findUnique.mockResolvedValue({
      id: 'session-1',
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Администратор',
        role: 'ADMIN',
        isActive: true,
        passwordHash: 'secret-hash',
      },
    });

    await expect(readSession()).resolves.toEqual({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Администратор',
      role: 'ADMIN',
    });
  });

  it('возвращает server-only precondition текущей сессии без bearer token', async () => {
    cookieMock.value = 'session-token';
    const expiresAt = new Date(Date.now() + 60_000);
    sessionRepository.findUnique.mockResolvedValue({
      id: 'session-1',
      tokenHash: 'secret-token-hash',
      expiresAt,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Администратор',
        role: 'ADMIN',
        isActive: true,
        passwordHash: 'secret-password-hash',
      },
    });

    const result = await getAuthenticatedSession();

    expect(result).toEqual({
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Администратор',
        role: 'ADMIN',
      },
      currentSessionId: 'session-1',
      currentSessionTokenHash: 'secret-token-hash',
      currentSessionExpiresAt: expiresAt,
    });
    expect(JSON.stringify(result)).not.toContain('session-token');
    expect(JSON.stringify(result)).not.toContain('secret-password-hash');
  });

  it('готовит новый bearer и выставляет cookie только отдельным commit-шагом', async () => {
    const expiresAt = new Date('2026-07-27T12:00:00.000Z');

    const rotation = prepareSessionRotation(expiresAt);

    expect(rotation.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rotation.expiresAt).toBe(expiresAt);
    expect(cookieMock.set).not.toHaveBeenCalled();

    await commitSessionRotationCookie(rotation);

    const token = cookieMock.set.mock.calls[0]?.[1];
    expect(typeof token).toBe('string');
    expect(hashSessionToken(token)).toBe(rotation.tokenHash);
    expect(cookieMock.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      token,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      }),
    );
  });

  it('удаляет все сессии пользователя, кроме текущей', async () => {
    await deleteOtherSessions('user-1', 'session-1');

    expect(sessionRepository.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', id: { not: 'session-1' } },
    });
  });

  it.each([
    ['истёкшую', { expiresAt: new Date(0), isActive: true, role: 'ADMIN' }],
    ['неактивную', { expiresAt: new Date(Date.now() + 60_000), isActive: false, role: 'ADMIN' }],
    [
      'не административную',
      { expiresAt: new Date(Date.now() + 60_000), isActive: true, role: 'USER' },
    ],
  ])('отклоняет %s сессию', async (_label, values) => {
    cookieMock.value = 'session-token';
    sessionRepository.findUnique.mockResolvedValue({
      id: 'session-1',
      expiresAt: values.expiresAt,
      user: { id: 'user-1', email: 'a@b.ru', name: 'A', ...values },
    });

    await expect(readSession()).resolves.toBeNull();
  });

  it('отзывает текущую сессию и очищает cookie', async () => {
    cookieMock.value = 'session-token';
    await deleteSession();

    expect(sessionRepository.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(cookieMock.set).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      '',
      expect.objectContaining({ expires: new Date(0), httpOnly: true, path: '/' }),
    );
  });
});
