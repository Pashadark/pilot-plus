import 'server-only';

import { prisma } from '@/database/prisma/client';
import type { AuthenticatedSession } from '@/services/auth/session';

import { buildProfileRole, type ProfileViewModel } from './profile-model';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export async function getProfileViewModel(
  session: AuthenticatedSession,
): Promise<ProfileViewModel> {
  const record = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      isActive: true,
      createdAt: true,
      updatedAt: true,
      profileBannerPath: true,
      memberships: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: {
          role: true,
          company: {
            select: {
              name: true,
              contractCity: true,
              actualAddress: true,
              directorName: true,
              members: {
                orderBy: { createdAt: 'asc' },
                select: {
                  role: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      role: true,
                      isActive: true,
                      avatarPath: true,
                      updatedAt: true,
                      sessions: {
                        where: { expiresAt: { gt: new Date() } },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { createdAt: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      sessions: {
        where: { expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, expiresAt: true },
      },
    },
  });

  const membership = record?.memberships[0];
  const role = buildProfileRole(session.user.role, membership?.role ?? null);
  const company = membership?.company;
  const lastLoginAt = record?.sessions[0]?.createdAt ?? new Date();
  const members = (company?.members ?? []).map((membership) => {
    const memberRole = buildProfileRole(membership.user.role, membership.role);
    return {
      id: membership.user.id,
      name: membership.user.name,
      role: memberRole.label,
      position: memberRole.position,
      status: membership.user.isActive ? 'Активен' : 'Отключён',
      avatarUrl: membership.user.avatarPath
        ? `/profile/team/${membership.user.id}/avatar?v=${membership.user.updatedAt.getTime().toString(36)}`
        : null,
      lastActivityAt: membership.user.sessions[0]?.createdAt
        ? dateTimeFormatter.format(membership.user.sessions[0].createdAt)
        : 'Нет активных сессий',
    };
  });

  return {
    user: session.user,
    bannerUrl: record?.profileBannerPath
      ? `/profile/banner?v=${record.updatedAt.getTime().toString(36)}`
      : null,
    role,
    company: {
      name: company?.name ?? 'СУПА ПРО',
      office: company?.contractCity ?? company?.actualAddress ?? 'Москва',
      legalRole:
        session.user.role === 'SUPER_ADMIN'
          ? 'Основатель и владелец'
          : company?.directorName
            ? `Команда ${company.directorName}`
            : role.position,
      members,
    },
    account: {
      status: record?.isActive === false ? 'Аккаунт отключён' : 'Аккаунт активен',
      registeredAt: dateFormatter.format(record?.createdAt ?? new Date()),
      lastLoginAt: dateTimeFormatter.format(lastLoginAt),
      sessionExpiresAt: dateTimeFormatter.format(session.currentSessionExpiresAt),
      activeSessions: record?.sessions.length ?? 1,
      sessions: (record?.sessions ?? []).map((activeSession) => ({
        id: activeSession.id,
        createdAt: dateTimeFormatter.format(activeSession.createdAt),
        expiresAt: dateTimeFormatter.format(activeSession.expiresAt),
        current: activeSession.id === session.currentSessionId,
      })),
    },
  };
}
