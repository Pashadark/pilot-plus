import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  createSession,
  deleteSession,
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
