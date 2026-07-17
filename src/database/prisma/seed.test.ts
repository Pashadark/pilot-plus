import { describe, expect, it } from 'vitest';

import { seedAdmin } from './seed';

type UpsertArguments = {
  where: { email: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

function createFakeUserRepository() {
  const calls: UpsertArguments[] = [];
  const emails = new Set<string>();

  return {
    calls,
    repository: {
      async findUnique({ where }: { where: { email: string } }) {
        return emails.has(where.email) ? { id: 'existing-user' } : null;
      },
      async upsert(arguments_: UpsertArguments) {
        calls.push(arguments_);
        emails.add(arguments_.where.email);
        return { id: 'admin-user', ...arguments_.create, ...arguments_.update };
      },
    },
  };
}

const validEnvironment = {
  PILOT_ADMIN_EMAIL: ' Admin@Example.COM ',
  PILOT_ADMIN_PASSWORD: 'Надёжный пароль 2026',
  PILOT_ADMIN_NAME: ' Администратор Pilot+ ',
};

describe('seedAdmin', () => {
  it('нормализует email и сообщает о создании пользователя', async () => {
    const fake = createFakeUserRepository();

    const result = await seedAdmin(validEnvironment, { user: fake.repository });

    expect(result).toEqual({ email: 'admin@example.com', created: true });
    expect(fake.calls[0]?.where).toEqual({ email: 'admin@example.com' });
  });

  it.each(['PILOT_ADMIN_EMAIL', 'PILOT_ADMIN_PASSWORD', 'PILOT_ADMIN_NAME'] as const)(
    'отклоняет отсутствующую или пустую переменную %s',
    async (variable) => {
      const fake = createFakeUserRepository();

      await expect(
        seedAdmin({ ...validEnvironment, [variable]: '   ' }, { user: fake.repository }),
      ).rejects.toThrow(variable);
      expect(fake.calls).toHaveLength(0);
    },
  );

  it('отклоняет пароль короче 12 символов до обращения к БД', async () => {
    const fake = createFakeUserRepository();

    await expect(
      seedAdmin(
        { ...validEnvironment, PILOT_ADMIN_PASSWORD: 'короткий' },
        { user: fake.repository },
      ),
    ).rejects.toThrow('не менее 12 символов');
    expect(fake.calls).toHaveLength(0);
  });

  it('передаёт в upsert только хеш пароля, роль администратора и активный статус', async () => {
    const fake = createFakeUserRepository();

    await seedAdmin(validEnvironment, { user: fake.repository });

    const call = fake.calls[0];
    expect(call?.create).not.toHaveProperty('password');
    expect(call?.update).not.toHaveProperty('password');
    expect(call?.create.passwordHash).toMatch(/^scrypt\$/);
    expect(call?.update.passwordHash).toBe(call?.create.passwordHash);
    expect(call?.create).toMatchObject({
      email: 'admin@example.com',
      name: 'Администратор Pilot+',
      role: 'ADMIN',
      isActive: true,
    });
    expect(call?.update).toMatchObject({
      name: 'Администратор Pilot+',
      role: 'ADMIN',
      isActive: true,
    });
  });

  it('повторно использует уникальный email и заменяет хеш', async () => {
    const fake = createFakeUserRepository();

    const first = await seedAdmin(validEnvironment, { user: fake.repository });
    const second = await seedAdmin(validEnvironment, { user: fake.repository });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0]?.where).toEqual(fake.calls[1]?.where);
    expect(fake.calls[0]?.create.passwordHash).not.toBe(fake.calls[1]?.create.passwordHash);
    expect(fake.calls[1]?.update.passwordHash).toBe(fake.calls[1]?.create.passwordHash);
  });
});
