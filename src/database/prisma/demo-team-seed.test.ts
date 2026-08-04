import { describe, expect, it } from 'vitest';

import { seedDemoTeam } from './seed';

type UserUpsertArguments = {
  where: { email: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

type MembershipUpsertArguments = {
  where: { companyId_userId: { companyId: string; userId: string } };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
};

function createDemoTeamDatabase() {
  const users = new Map<string, { id: string; email: string }>();
  const memberships = new Map<string, Record<string, unknown>>();
  const userUpserts: UserUpsertArguments[] = [];
  const membershipUpserts: MembershipUpsertArguments[] = [];

  return {
    users,
    memberships,
    userUpserts,
    membershipUpserts,
    database: {
      user: {
        async upsert(arguments_: UserUpsertArguments) {
          userUpserts.push(arguments_);
          const user = users.get(arguments_.where.email) ?? {
            id: `user-${users.size + 1}`,
            email: arguments_.where.email,
          };
          users.set(arguments_.where.email, user);
          return user;
        },
      },
      companyMember: {
        async upsert(arguments_: MembershipUpsertArguments) {
          membershipUpserts.push(arguments_);
          const { companyId, userId } = arguments_.where.companyId_userId;
          const key = `${companyId}:${userId}`;
          memberships.set(key, { ...arguments_.create, ...arguments_.update });
          return { id: key };
        },
      },
    },
  };
}

describe('seed демонстрационной команды', () => {
  it('создаёт четыре неактивных профиля без рабочих паролей и назначает роли компании', async () => {
    const fake = createDemoTeamDatabase();

    const result = await seedDemoTeam(fake.database, 'pilot-demo-company');

    expect(result).toEqual({ users: 4, memberships: 4 });
    expect(fake.userUpserts.map((call) => call.create)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'anna.vorontsova@sever-trans.demo',
          name: 'Анна Воронцова',
          role: 'MEMBER',
          isActive: false,
        }),
        expect.objectContaining({ email: 'maksim.orlov@sever-trans.demo' }),
        expect.objectContaining({ email: 'dmitry.sokolov@sever-trans.demo' }),
        expect.objectContaining({ email: 'elena.mironova@sever-trans.demo' }),
      ]),
    );
    expect(fake.userUpserts.every((call) => typeof call.create.passwordHash === 'string')).toBe(
      true,
    );
    expect(fake.userUpserts.every((call) => !('password' in call.create))).toBe(true);
    expect(fake.membershipUpserts.map((call) => call.create.role)).toEqual([
      'COMPANY_ADMIN',
      'DISPATCHER',
      'DRIVER',
      'VIEWER',
    ]);
    expect(
      fake.membershipUpserts.every(
        (call) =>
          Array.isArray(call.create.additionalPermissions) &&
          call.create.additionalPermissions.length === 0,
      ),
    ).toBe(true);
  });

  it('повторным запуском не создаёт дубликаты email или членств', async () => {
    const fake = createDemoTeamDatabase();

    await seedDemoTeam(fake.database, 'pilot-demo-company');
    await seedDemoTeam(fake.database, 'pilot-demo-company');

    expect(fake.users.size).toBe(4);
    expect(fake.memberships.size).toBe(4);
    expect(new Set(fake.userUpserts.map((call) => call.where.email)).size).toBe(4);
    expect(
      new Set(
        fake.membershipUpserts.map(
          ({ where }) => `${where.companyId_userId.companyId}:${where.companyId_userId.userId}`,
        ),
      ).size,
    ).toBe(4);
  });
});
